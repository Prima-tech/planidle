import { Injectable } from '@angular/core';
import { BehaviorSubject, debounceTime, merge, skip } from 'rxjs';
import { StorageService } from './storage.service';
import { PlayerStateService, PlayerState } from './player-state.service';
import { InventoryService, InventoryItem } from './inventory.service';
import { SupabaseService } from './supabase.service';

/**
 * Pon OFFLINE_MODE = true para desarrollo sin Supabase.
 * En offline, todo se guarda solo en local y el botón de guardar no intenta la llamada remota.
 */
const OFFLINE_MODE = false;

const STORAGE_KEY = 'game_snapshot';

export type SaveStatus = 'idle' | 'local' | 'remote' | 'saved' | 'error';

interface GameSnapshot {
  playerState: PlayerState;
  inventory: (InventoryItem | null)[][][];
  lastModified: string;
}

@Injectable({ providedIn: 'root' })
export class SaveService {

  readonly status$ = new BehaviorSubject<SaveStatus>('idle');

  constructor(
    private storage: StorageService,
    private playerState: PlayerStateService,
    private inventory: InventoryService,
    private supabase: SupabaseService,
  ) {
    // Cualquier cambio en playerState o inventario → guarda en local tras 2s de inactividad
    merge(this.playerState.state$, this.inventory.changes$)
      .pipe(skip(1), debounceTime(2000))
      .subscribe(() => this.saveLocal());
  }

  /**
   * Llamar al arrancar la app. Carga el snapshot local y puebla los servicios.
   * PlayerStateService ya se puebla desde AsgardService.getProfile(), pero si hay
   * un snapshot más reciente aquí, lo sobreescribe.
   */
  async loadAll(): Promise<void> {
    const snapshot: GameSnapshot | null = await this.storage.get(STORAGE_KEY);
    if (!snapshot) return;
    this.playerState.setFromProfile(snapshot.playerState);
    this.inventory.restoreFromSnapshot(snapshot.inventory);
  }

  /** Botón "Guardar" en settings: escribe local y luego intenta remoto */
  async forceSave(): Promise<void> {
    await this.saveLocal();
    await this.saveRemote();
  }

  private buildSnapshot(): GameSnapshot {
    return {
      playerState: this.playerState.snapshot(),
      inventory:   this.inventory.getSnapshot(),
      lastModified: new Date().toISOString(),
    };
  }

  private async saveLocal(): Promise<void> {
    this.status$.next('local');
    await this.storage.set(STORAGE_KEY, this.buildSnapshot());
    this.status$.next('saved');
    setTimeout(() => this.status$.next('idle'), 2000);
  }

  private async saveRemote(): Promise<void> {
    if (OFFLINE_MODE) {
      console.log('[Save] Modo offline — guardado remoto omitido');
      return;
    }
    try {
      this.status$.next('remote');
      const snap = this.buildSnapshot();
      await this.supabase.saveGameData(snap.playerState, snap.inventory);
      this.status$.next('saved');
      setTimeout(() => this.status$.next('idle'), 2000);
    } catch (e) {
      console.warn('[Save] Error al guardar en Supabase — datos seguros en local', e);
      this.status$.next('error');
      setTimeout(() => this.status$.next('idle'), 3000);
    }
  }
}
