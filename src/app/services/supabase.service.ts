import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './storage.service';
import { ForgeService } from './forge.service';
import { GlobalTalentsService } from './global-talents.service';
import { MapUpgradesService } from './map-upgrades.service';
import { AccountShopService } from './account-shop.service';
import { RunProgressService } from './run-progress.service';
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private storageService: StorageService, private forge: ForgeService,
              private globalTalents: GlobalTalentsService,
              private mapUpgrades: MapUpgradesService,
              private accountShop: AccountShopService,
              private runProgress: RunProgressService) {
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

  /** ¿Hay sesión de Supabase activa (persistida o recién iniciada)? Solo lee el token
   *  LOCAL, sin validar contra el servidor. */
  async hasSession(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    return !!data.session;
  }

  /** ¿Hay sesión VÁLIDA confirmada por el servidor? A diferencia de hasSession() (que
   *  solo lee el token local), llama a getUser() y valida contra Supabase. Devuelve true
   *  solo si el servidor confirma el usuario. Sin red, o con la cuenta borrada/expulsada
   *  (p. ej. wipe del admin) → false: la autenticación requiere conexión. */
  async hasValidServerSession(): Promise<boolean> {
    const { data, error } = await this.supabase.auth.getUser();
    return !error && !!data?.user;
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

  /** Alta como INVITADO: crea un usuario anónimo real (UUID sin email) y abre sesión.
   *  El trigger `handle_new_user` le crea su fila `global_data` + roster igual que a
   *  cualquiera; después bajamos sus datos a local. La sesión queda PERSISTIDA
   *  (persistSession) → al reabrir la app revive sola, sin volver a "iniciar sesión".
   *  Requiere "Anonymous sign-ins" ACTIVADO en el dashboard de Supabase.
   *  Limitación: la cuenta vive atada a este dispositivo hasta que se vincule un correo
   *  (`linkEmail`); si se borra el almacenamiento o se desinstala, se pierde. */
  async signInAnonymously() {
    const response = await this.supabase.auth.signInAnonymously();
    if (response.data.user) {
      await this.fetchAndSaveLocalData(response.data.user.id);
    }
    return response;
  }

  /** ¿La sesión actual es de un INVITADO (anónimo, sin email)? Lo usa el panel de
   *  ajustes para mostrar el bloque "Vincular correo" solo a los invitados. */
  async isAnonymous(): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    return !!user?.is_anonymous;
  }

  /** ID de la sesión de INVITADO guardada LOCALMENTE (sin red), o null si no hay sesión
   *  o no es de invitado. Lo usa el login para ofrecer "Continuar como invitado (ID)"
   *  tras cerrar sesión: como el invitado no tiene credenciales, no se destruye su sesión
   *  al salir, y desde aquí se puede reanudar la MISMA cuenta. */
  async getLocalGuestId(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    const user = data.session?.user;
    return user?.is_anonymous ? user.id : null;
  }

  /** Identidad de la sesión actual para pintar la pastilla de ajustes:
   *  - anónimo → { isAnonymous: true, id } (el UID de invitado)
   *  - con email → { isAnonymous: false, email, id }
   *  Devuelve null si no hay sesión. */
  async getIdentity(): Promise<{ isAnonymous: boolean; email: string | null; id: string } | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;
    return { isAnonymous: !!user.is_anonymous, email: user.email ?? null, id: user.id };
  }

  /** Vincula email + contraseña a la cuenta INVITADA actual, convirtiéndola en
   *  permanente y recuperable desde cualquier dispositivo. NO crea un usuario nuevo:
   *  mantiene el MISMO `user.id`, así que todos los personajes y datos siguen intactos
   *  (upgrade in-place). Si el email YA pertenece a otra cuenta, Supabase devuelve error
   *  (no se pueden fusionar dos cuentas). */
  async linkEmail(email: string, pass: string) {
    return await this.supabase.auth.updateUser({ email, password: pass });
  }

  /** ¿La cuenta logueada tiene el acceso BLOQUEADO? Lee `global_data.account` del
   *  propio usuario (la RLS le deja leer su fila) y devuelve el motivo:
   *  - 'banned'  → la marcó el PANEL DE ADMIN vía la RPC `admin_set_ban`.
   *  - 'deleted' → la marcó el propio usuario con "Borrar cuenta (nube)" en ajustes
   *    (soft-delete: la fila sigue existiendo, pero no se puede volver a entrar).
   *  El login lo comprueba en todas sus vías y bloquea el acceso. Ante cualquier error
   *  de red devuelve null (no bloqueamos por un fallo puntual). */
  async accessBlock(): Promise<'banned' | 'deleted' | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await this.supabase
        .from('global_data').select('account').eq('id', user.id).single();
      if (error) return null;
      const account = (data as any)?.account;
      if (account?.banned)  return 'banned';
      if (account?.deleted) return 'deleted';
      return null;
    } catch {
      return null;
    }
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

      // Compras de la tienda premium (account.accountShop): fusiona nube + local.
      await this.accountShop.restore((data as any).account?.accountShop ?? null);

      // Progresión del run COMPARTIDA (account.runProgress): estrellas + hitos +
      // stats agregadas por personaje. Globales entre personajes.
      await this.runProgress.restore((data as any).account?.runProgress ?? null);

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
      // No existe la fila de cuenta, o la RLS de SELECT no deja leerla. Normalmente la crea
      // el trigger handle_new_user al registrarse. Si llegamos aquí: el trigger falló, es un
      // usuario legacy sin fila, o falta la policy de SELECT propia (id = auth.uid()) en
      // global_data (solo estaba la de admin) → el invitado no puede leer su fila.
      console.error('[Supabase] global_data no existe/ilegible para el usuario: revisa el trigger handle_new_user y la RLS de SELECT de global_data.');
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

  /** SOFT-DELETE de la cuenta: NO borra nada de la nube, solo marca
   *  `global_data.account.deleted = true` (merge, sin pisar el resto del account).
   *  Con la marca puesta, `accessBlock()` devuelve 'deleted' y el login no deja
   *  volver a entrar con esta cuenta por ninguna vía. Los datos quedan en la BD
   *  (el panel de admin puede inspeccionarlos o restaurarlos quitando el flag). */
  async markAccountDeleted(): Promise<void> {
    await this.saveAccountData({ deleted: true, deletedAt: new Date().toISOString() });
  }

}