import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './storage.service';
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private storageService: StorageService) {
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
    { name: 'Merlin',   max_hp: 65  },
    { name: 'Aldric',   max_hp: 90  },
    { name: 'Seraphel', max_hp: 80  },
    { name: 'Malachar', max_hp: 70  },
    { name: 'Solmara',  max_hp: 100 },
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

  /** Sube el GameSnapshot completo a la columna `snapshot` del personaje.
   *  Las columnas espejo (lvl/coins/hp) permiten pintar el roster sin parsear el JSON. */
  async saveCharacterSnapshot(charId: string, snapshot: any): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');

    const ps = snapshot?.playerState ?? {};
    const { error } = await this.supabase
      .from('characters')
      .update({
        snapshot,
        lvl:           ps.lvl,
        coins:         ps.coins,
        current_hp:    ps.hp,
        max_hp:        ps.hpMax,
        last_modified: snapshot?.lastModified ?? new Date().toISOString(),
      })
      .eq('id', charId)
      .eq('profile_id', user.id);

    if (error) throw error;
  }

  /** Guarda datos a nivel de CUENTA (no por personaje) en global_data.account.
   *  Hoy: logros globales. Aquí irán futuros sistemas de cuenta (kills globales,
   *  ciudad, tienda…). */
  async saveAccountData(account: any): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');

    const { error } = await this.supabase
      .from('global_data')
      .update({ account, last_modified: new Date().toISOString() })
      .eq('id', user.id);

    if (error) throw error;
  }

}