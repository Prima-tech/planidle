import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

/**
 * Modo de conexión elegido por el usuario en el login:
 *  - 'supabase' → autentica e intenta sincronizar con la nube (botón Guardar).
 *  - 'local'    → juega 100% offline; el botón Guardar solo escribe en local.
 *
 * La elección se persiste para que sobreviva a recargas de la app.
 */
const KEY = 'connection_mode';

@Injectable({ providedIn: 'root' })
export class ConnectionService {

  /** true = modo Supabase (online) · false = modo local. */
  readonly useSupabase$ = new BehaviorSubject<boolean>(false);

  constructor(
    private storage: StorageService,
    private supabase: SupabaseService,
  ) {}

  get useSupabase(): boolean {
    return this.useSupabase$.value;
  }

  /** Lee el modo guardado. Llamar al arrancar (login / layout). */
  async load(): Promise<void> {
    const mode = await this.storage.get(KEY);
    this.useSupabase$.next(mode === 'supabase');
  }

  /** Fija el modo (lo elige el toggle del login) y lo persiste. */
  async setUseSupabase(value: boolean): Promise<void> {
    this.useSupabase$.next(value);
    await this.storage.set(KEY, value ? 'supabase' : 'local');
  }

  /** ¿Conectado de verdad? = modo Supabase + sesión activa. */
  async isConnected(): Promise<boolean> {
    if (!this.useSupabase) return false;
    return this.supabase.hasSession();
  }

  /** Cierra la sesión de Supabase y vuelve a modo local. */
  async logout(): Promise<void> {
    await this.supabase.signOut();
    await this.setUseSupabase(false);
  }
}
