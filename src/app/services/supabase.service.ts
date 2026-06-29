import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './storage.service';
import { ForgeService } from './forge.service';
import { GlobalTalentsService } from './global-talents.service';
import { MapUpgradesService } from './map-upgrades.service';
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private storageService: StorageService, private forge: ForgeService,
              private globalTalents: GlobalTalentsService,
              private mapUpgrades: MapUpgradesService) {
    const offlineFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      fetch(input, init).catch(() => new Response(null, { status: 503, statusText: 'Service Unavailable' }));

    this.supabase = createClient('https://ycadrkbdmdwjtkslpbpp.supabase.co',
      'sb_publishable_5Hs1VoKmBEEpK0dsAYpJ7g_CNAf0WGG',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          // Evita la Web Locks API (navigator.locks): en dev con HMR o varias
          // pestañas lanza NavigatorLockAcquireTimeoutError. Como la app es
          // offline-first y de una sola pestaña, ejecutamos la función directa.
          lock: (_name, _acquireTimeout, fn) => fn(),
        },
        global: { fetch: offlineFetch }
      }
    );
  }

  // --- AUTHENTICATION ---

  /** ¿Hay sesión de Supabase activa (persistida o recién iniciada)? */
  async hasSession(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    return !!data.session;
  }

  async signUp(email: string, pass: string) {
    return await this.supabase.auth.signUp({ email, password: pass });
  }

  async signOut() {
    return await this.supabase.auth.signOut();
  }

  async signIn(email: string, pass: string) {
    const response = await this.supabase.auth.signInWithPassword({ email, password: pass });
    if (response.data.user) {
      await this.fetchAndSaveLocalData(response.data.user.id);
    }
    return response;
  }

  // --- GAME DATA MANAGEMENT ---
  /*
  async fetchAndSaveLocalData(userId: string) {
    //this.asgardService.setCharacters(this.getCharacters(userId));
  }
  */

  static readonly ROSTER_TEMPLATE: { name: string; max_hp: number }[] = [
    { name: 'Gutts',    max_hp: 120 },
    { name: 'Kugo',     max_hp: 110 },
    { name: 'Italien',  max_hp: 95  },
    { name: 'Rake',     max_hp: 100 },
  ];

  async fetchAndSaveLocalData(userId: string) {
    const { data, error } = await this.supabase
      .from('global_data')
      .select(`*, characters (*), achievements (*)`)
      .eq('id', userId)
      .single();

    if (data) {
      let chars: any[] = data.characters ?? [];

      // Migration: insert any missing character slots for existing accounts
      if (chars.length < SupabaseService.ROSTER_TEMPLATE.length) {
        const existingNames = new Set(chars.map((c: any) => c.name));
        const missing = SupabaseService.ROSTER_TEMPLATE
          .filter(t => !existingNames.has(t.name))
          .map(t => ({
            profile_id: userId,
            name: t.name,
            current_hp: t.max_hp,
            max_hp: t.max_hp,
            lvl: 1,
            exp: 0,
            last_modified: new Date().toISOString(),
          }));

        if (missing.length > 0) {
          const { data: newChars } = await this.supabase
            .from('characters')
            .insert(missing)
            .select();
          if (newChars) chars = [...chars, ...newChars];
        }
      }

      await this.storageService.set('user_data', data);

      // Logros de CUENTA (globales): viven en global_data.account. Como son un
      // Set monotónico (solo crece), fusionamos nube + local para no perder nada.
      const cloudGlobalAch: string[] = (data as any).account?.achievementsGlobal ?? [];
      const localGlobalAch: string[] = (await this.storageService.get('achievements_global')) ?? [];
      const mergedGlobalAch = [...new Set([...cloudGlobalAch, ...localGlobalAch])];
      await this.storageService.set('achievements_global', mergedGlobalAch);

      // Talentos globales de cuenta (global_data.account.globalTalents): la cuenta manda.
      await this.globalTalents.restore((data as any).account?.globalTalents ?? null);

      // Mejoras de mapa (global_data.account.mapUpgrades): globales entre personajes.
      await this.mapUpgrades.restore((data as any).account?.mapUpgrades ?? null);

      // Forjas de CUENTA (columna `forges`): globales entre personajes. El tiempo
      // offline lo calcula el SERVIDOR (claim_forge_offline) → no se puede trampear
      // adelantando el reloj del móvil. La nube + ese tiempo mandan sobre el local.
      const cloudForges = (data as any).forges ?? null;
      if (cloudForges?.forges?.length) {
        let serverElapsed: number | null = null;
        try { serverElapsed = await this.claimForgeOffline(); }
        catch (e) { console.warn('[Supabase] claim_forge_offline falló — uso tiempo local', e); }
        await this.forge.syncFromCloud(cloudForges, serverElapsed);
      }

      // Offline-first: baja el snapshot de cada personaje a su clave local.
      // Conflicto: si el local es más nuevo (el jugador siguió jugando offline),
      // se respeta el local y NO se pisa con la nube.
      for (const char of chars) {
        if (!char.snapshot) continue;
        const key = `snapshot_char_${char.id}`;
        const local: any = await this.storageService.get(key);
        const cloudTime = new Date(char.snapshot.lastModified ?? 0).getTime();
        const localTime = new Date(local?.lastModified ?? 0).getTime();
        if (!local || cloudTime > localTime) {
          await this.storageService.set(key, char.snapshot);
          await this.storageService.set(`${key}_synced`, char.snapshot);
        }
        // Base de versión para la concurrencia optimista: tras el login, la versión
        // que tiene la nube es nuestra base. El guardado condiciona el UPDATE a ella;
        // si otro dispositivo la sube después, el siguiente save detecta el conflicto.
        await this.storageService.set(`${key}_v`, char.version ?? 0);
      }

      // Roster ligero: el snapshot vive en su propia clave, no en el array del roster.
      const roster = chars.map(({ snapshot, ...rest }: any) => rest);
      await this.storageService.set('characters', roster);
      return data;
    } else if (error?.code === 'PGRST116') {
      // No existe la fila de cuenta. La crea el trigger handle_new_user al
      // registrarse (único dueño de la creación). Si llegamos aquí, el trigger
      // falló o es un usuario legacy sin fila.
      console.error('[Supabase] global_data no existe para el usuario: el trigger handle_new_user debería haberla creado al registrarse.');
    }
    return null;
  }

  // --- SAVE / LOAD POR PERSONAJE (snapshot JSONB) ---

  /** Sube el GameSnapshot completo a la columna `snapshot` del personaje, con
   *  CONCURRENCIA OPTIMISTA: solo escribe si la fila sigue en `expectedVersion` y, en
   *  el mismo UPDATE, la sube a `expectedVersion + 1`. Si otro dispositivo guardó entre
   *  medias, la versión ya no coincide → 0 filas afectadas → devuelve { ok: false }
   *  (conflicto). No depende de relojes. Las columnas espejo (lvl/coins/hp) permiten
   *  pintar el roster sin parsear el JSON. */
  async saveCharacterSnapshot(charId: string, snapshot: any, expectedVersion: number): Promise<{ ok: boolean; version: number }> {
    // Vía RPC SECURITY DEFINER: la RLS de `characters` no concede UPDATE directo al
    // cliente (solo SELECT/DELETE), así que el guardado pasa por la función del
    // servidor, que valida auth.uid() = profile_id y hace el UPDATE condicionado a la
    // versión (concurrencia optimista) ahí dentro. Las columnas espejo (lvl/coins/hp)
    // y los timestamps los sella el servidor (trigger). Devuelve la nueva versión, o
    // null si la versión no coincidía (conflicto) o la fila no es tuya.
    const { data, error } = await this.supabase.rpc('save_character', {
      p_char: String(charId),
      p_snapshot: snapshot,
      p_expected_version: expectedVersion,
    });
    if (error) throw error;
    if (data == null) return { ok: false, version: expectedVersion };
    return { ok: true, version: data as number };
  }

  /** Reclama el tiempo offline con la HORA DEL SERVIDOR (no la del cliente): la RPC
   *  calcula `now() - last_seen` (capado), sella `last_seen = now()` y devuelve los
   *  segundos efectivos. Así el reloj del móvil no puede fabricar progreso. Devuelve
   *  null si no hay sesión/fila (el llamador cae al cálculo local en modo offline). */
  async claimOffline(charId: string): Promise<number | null> {
    const { data, error } = await this.supabase.rpc('claim_offline', { p_char: String(charId) });
    if (error) throw error;
    if (data == null) return null;
    // Acepta tanto retorno ESCALAR (int) como TABLA ([{elapsed_seconds}]) u objeto,
    // según cómo esté definida la función en la BD. Si no sale un número finito,
    // devuelve null → el llamador cae al tiempo local (no NaN).
    let val: any = data;
    if (Array.isArray(data))            val = data[0]?.elapsed_seconds ?? data[0];
    else if (typeof data === 'object')  val = (data as any).elapsed_seconds;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  /** Lee la meta de sincronización del personaje en la nube: su `version` (para la
   *  concurrencia optimista) y `last_modified` (solo para el mensaje al usuario).
   *  Devuelve null si la fila no existe. */
  async getRemoteCharacterMeta(charId: string): Promise<{ version: number; lastModified: string | null } | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');

    const { data, error } = await this.supabase
      .from('characters')
      .select('version, last_modified')
      .eq('id', charId)
      .eq('profile_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;   // no existe la fila
      throw error;
    }
    return {
      version:      (data as any)?.version ?? 0,
      lastModified: (data as any)?.last_modified ?? null,
    };
  }

  /** Sube el snapshot de TODAS las forjas (columna `forges`). El servidor sella
   *  `forges_last_seen = now()` en la RPC, así el tiempo es de servidor (no del cliente). */
  async saveForges(forges: any): Promise<void> {
    const { error } = await this.supabase.rpc('save_forges', { p_forges: forges });
    if (error) throw error;
  }

  /** Reclama el tiempo offline de las forjas con la HORA DEL SERVIDOR: la RPC calcula
   *  `now() - forges_last_seen` (capado), re-sella y devuelve los segundos. Así el
   *  reloj del móvil no puede fabricar producción offline. null si no hay sello aún. */
  async claimForgeOffline(): Promise<number | null> {
    const { data, error } = await this.supabase.rpc('claim_forge_offline');
    if (error) throw error;
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  }

  /** Guarda datos a nivel de CUENTA (no por personaje) en global_data.account.
   *  Hoy: logros globales + talentos globales. Aquí irán futuros sistemas de cuenta
   *  (kills globales, ciudad, tienda…).
   *
   *  Blindado: hace MERGE con el `account` que ya hay en la nube en vez de pisarlo.
   *  Así, si el llamador manda solo algunos campos (o se añade uno nuevo en el futuro
   *  que esta llamada aún no incluya), el resto NO se pierde. */
  async saveAccountData(account: any): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');

    // Lee el account actual para fusionar (read-merge-write). Si no se puede leer,
    // seguimos con lo que hay (no abortamos el guardado por ello).
    let current: any = {};
    const { data: row } = await this.supabase
      .from('global_data')
      .select('account')
      .eq('id', user.id)
      .single();
    if (row?.account && typeof row.account === 'object') current = row.account;

    const merged = { ...current, ...account };

    const { error } = await this.supabase
      .from('global_data')
      .update({ account: merged, last_modified: new Date().toISOString() })
      .eq('id', user.id);

    if (error) throw error;
  }

  /** Borra los DATOS de juego de la cuenta en la nube: ELIMINA todas las filas de
   *  personajes (incluidas las obsoletas) y resetea global_data.account. Al volver a
   *  entrar, fetchAndSaveLocalData reinserta el roster limpio de ROSTER_TEMPLATE. */
  async wipeRemoteData(): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');

    const { error: charErr } = await this.supabase
      .from('characters')
      .delete()
      .eq('profile_id', user.id);
    if (charErr) throw charErr;

    const { error: accErr } = await this.supabase
      .from('global_data')
      .update({ account: null, last_modified: new Date().toISOString() })
      .eq('id', user.id);
    if (accErr) throw accErr;
  }

}