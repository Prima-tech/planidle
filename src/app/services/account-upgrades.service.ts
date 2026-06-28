import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';

/**
 * Mejoras de CUENTA (globales, compartidas entre todos los personajes). Se asignan
 * con un total de puntos (TOTAL_POINTS); activar una mejora consume su coste. Viven
 * en la ventana de "Talentos globales".
 *
 * Persistencia local (StorageService) + nivel de cuenta en Supabase
 * (global_data.account.accountUpgrades, junto a los logros).
 */

export interface AccountUpgrade { id: string; name: string; desc: string; cost: number; }

/** Catálogo de mejoras de cuenta. Añadir aquí nuevas. */
export const ACCOUNT_UPGRADES: AccountUpgrade[] = [
  {
    id: 'forge_upgrades',
    name: 'Mejoras de forjas',
    desc: 'Desbloquea la pestaña de mejoras en todas las forjas.',
    cost: 1,
  },
];

const STORAGE_KEY = 'account_upgrades';

@Injectable({ providedIn: 'root' })
export class AccountUpgradesService {
  /** Puntos totales a repartir entre las mejoras de cuenta. */
  static readonly TOTAL_POINTS = 10;

  private storage = inject(StorageService);
  private active = new Set<string>();
  private loadPromise: Promise<void>;

  /** Mejora "mejoras de forjas" activa → las forjas muestran su pestaña de mejoras. */
  readonly forgeUpgradesUnlocked$ = new BehaviorSubject<boolean>(false);
  /** Puntos que quedan por asignar. */
  readonly availablePoints$ = new BehaviorSubject<number>(AccountUpgradesService.TOTAL_POINTS);

  constructor() { this.loadPromise = this.load(); }

  get total(): number { return AccountUpgradesService.TOTAL_POINTS; }
  private costOf(id: string): number { return ACCOUNT_UPGRADES.find(u => u.id === id)?.cost ?? 0; }
  get spent(): number { let s = 0; this.active.forEach(id => s += this.costOf(id)); return s; }
  get available(): number { return this.total - this.spent; }

  isActive(id: string): boolean { return this.active.has(id); }

  /** Activa (si hay puntos) o desactiva (libera el punto) una mejora. */
  toggle(id: string): void {
    if (this.active.has(id)) {
      this.active.delete(id);
    } else {
      if (this.available < this.costOf(id)) return;   // sin puntos suficientes
      this.active.add(id);
    }
    this.emit();
    this.persist();
  }

  private emit(): void {
    this.forgeUpgradesUnlocked$.next(this.active.has('forge_upgrades'));
    this.availablePoints$.next(this.available);
  }

  // ── Persistencia local ──────────────────────────────────────────────────────

  private async load(): Promise<void> {
    try {
      const saved = (await this.storage.get(STORAGE_KEY)) as string[] | null;
      if (Array.isArray(saved)) this.active = new Set(saved.filter(id => this.costOf(id) >= 0));
    } catch (e) {
      console.warn('[account-upgrades] no se pudo restaurar', e);
    }
    this.emit();
  }

  private persist(): void { this.storage.set(STORAGE_KEY, [...this.active]); }

  // ── Cuenta (Supabase global_data.account) ────────────────────────────────────

  /** IDs activos para subir a la nube (lo llama SaveService). */
  getSnapshot(): string[] { return [...this.active]; }

  /** Restaura desde la nube al loguear (la cuenta manda). Espera a tener lo local. */
  async restore(ids: string[] | null | undefined): Promise<void> {
    await this.loadPromise;
    if (!Array.isArray(ids)) return;
    this.active = new Set(ids);
    this.emit();
    this.persist();
  }
}
