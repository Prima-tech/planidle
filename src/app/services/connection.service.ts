import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

/**
 * Modo de conexión elegido por el usuario en el login:
 *  - 'supabase' → autentica e intenta sincronizar con la nube (botón Guardar).
 *  - 'local'    → juega 100% offline; el botón Guardar solo escribe en local.
 *
 * El modo por DEFECTO es Supabase: el local es una excepción que hay que pedir
 * explícitamente con el toggle del login (sin esto, un dispositivo sin preferencia
 * guardada caía en local sin avisar y la partida no subía a la nube).
 *
 * La elección se persiste para que sobreviva a recargas de la app.
 */
const KEY = 'connection_mode';
// Marca de un solo uso: el próximo arranque no debe auto-entrar con la sesión guardada.
const SKIP_AUTO_KEY = 'skip_auto_login';
// Versión del ajuste de modo. Cuando Supabase pasó a ser el defecto, los dispositivos
// que ya tenían 'local' guardado (de cuando ESE era el defecto) seguían desconectados
// sin haberlo pedido. Al subir la versión se descarta ese valor heredado una vez.
const MODE_VERSION_KEY = 'connection_mode_v';
const MODE_VERSION = 2;

@Injectable({ providedIn: 'root' })
export class ConnectionService {

  /** true = modo Supabase (online) · false = modo local. Por defecto, Supabase. */
  readonly useSupabase$ = new BehaviorSubject<boolean>(true);

  constructor(
    private storage: StorageService,
    private supabase: SupabaseService,
  ) {}

  get useSupabase(): boolean {
    return this.useSupabase$.value;
  }

  /** Lee el modo guardado. Llamar al arrancar (login / layout). Sin preferencia
   *  guardada → Supabase: solo un 'local' explícito y RECIENTE desconecta. */
  async load(): Promise<void> {
    const version = await this.storage.get(MODE_VERSION_KEY);
    if (version !== MODE_VERSION) {
      // Migración: olvida el modo heredado y arranca en Supabase. A partir de aquí
      // manda lo que elija el jugador con el toggle del login.
      await this.storage.remove(KEY);
      await this.storage.set(MODE_VERSION_KEY, MODE_VERSION);
      this.useSupabase$.next(true);
      return;
    }
    const mode = await this.storage.get(KEY);
    this.useSupabase$.next(mode !== 'local');
  }

  /** Fija el modo (lo elige el toggle del login) y lo persiste. */
  async setUseSupabase(value: boolean): Promise<void> {
    this.useSupabase$.next(value);
    await this.storage.set(KEY, value ? 'supabase' : 'local');
    await this.storage.set(MODE_VERSION_KEY, MODE_VERSION);   // elección del jugador: ya no se migra
  }

  /** Pide que el próximo login NO auto-entre con la sesión guardada. Lo usa el
   *  "Cerrar sesión" de un INVITADO: su sesión sigue viva (no tiene credenciales con
   *  que volver), pero no queremos revivirla sola. Antes esto se hacía pasando a modo
   *  local, lo que dejaba la cuenta sin sincronizar con la nube sin avisar. */
  async suppressAutoLogin(): Promise<void> {
    await this.storage.set(SKIP_AUTO_KEY, true);
  }

  /** Lee y consume la marca anterior (un solo uso). */
  async consumeAutoLoginSuppression(): Promise<boolean> {
    const skip = await this.storage.get(SKIP_AUTO_KEY);
    if (skip) await this.storage.remove(SKIP_AUTO_KEY);
    return !!skip;
  }

  /** ¿Conectado de verdad? = modo Supabase + sesión activa. */
  async isConnected(): Promise<boolean> {
    if (!this.useSupabase) return false;
    return this.supabase.hasSession();
  }

  /** Cierra la sesión de Supabase. NO cambia el modo: al volver al login se sigue
   *  en Supabase (cerrar sesión no es "quiero jugar desconectado"); para eso está el
   *  toggle Local. */
  async logout(): Promise<void> {
    await this.supabase.signOut();
  }
}
