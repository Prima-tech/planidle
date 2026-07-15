import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';
import { PlayerStateService } from './player-state.service';

/**
 * TIENDA PREMIUM (botón del minimapa): artículos que se pagan con Marcas del
 * condenado (`specialCoins`). Los desbloqueos son de CUENTA: comprar una vez vale
 * para TODOS los personajes. Persisten en local + Supabase
 * (global_data.account.accountShop), mismo patrón que los talentos globales.
 * Como son monotónicos (solo se compran, nunca se pierden), restore() fusiona
 * nube + local para no perder una compra hecha offline.
 */
export interface AccountShopItem {
  id: string;
  nameKey: string;    // clave i18n del nombre
  descKey: string;    // clave i18n de la descripción
  price: number;      // Marcas del condenado
  requires?: string;  // artículo que hay que poseer antes (compras encadenadas)
}

// Sets de equipo II y III: las pestañas de la ventana de equipo. El set I es gratis;
// cada compra añade una pestaña (para TODOS los personajes). El III requiere el II.
export const ACCOUNT_SHOP_ITEMS: AccountShopItem[] = [
  { id: 'equip_set_2', nameKey: 'SHOP.ITEMS.EQUIP_SET_2.NAME', descKey: 'SHOP.ITEMS.EQUIP_SET_2.DESC', price: 50 },
  { id: 'equip_set_3', nameKey: 'SHOP.ITEMS.EQUIP_SET_3.NAME', descKey: 'SHOP.ITEMS.EQUIP_SET_3.DESC', price: 50, requires: 'equip_set_2' },
];

const STORAGE_KEY = 'account_shop';

@Injectable({ providedIn: 'root' })
export class AccountShopService {
  private storage = inject(StorageService);
  private playerState = inject(PlayerStateService);

  private purchased = new Set<string>();
  private loadPromise: Promise<void>;

  /** Emite tras cualquier compra/restore (para refrescar tienda y panel de equipo). */
  readonly changes$ = new BehaviorSubject<void>(undefined);

  constructor() { this.loadPromise = this.load(); }

  isPurchased(id: string): boolean { return this.purchased.has(id); }

  /** ¿Cumple el prerrequisito de compra (artículo encadenado)? */
  requirementMet(item: AccountShopItem): boolean {
    return !item.requires || this.purchased.has(item.requires);
  }

  /** Compra un artículo: descuenta las Marcas del personaje ACTIVO y desbloquea
   *  para toda la cuenta. false si ya está comprado, falta su prerrequisito o no
   *  alcanzan las Marcas. */
  buy(id: string): boolean {
    const item = ACCOUNT_SHOP_ITEMS.find(i => i.id === id);
    if (!item || this.purchased.has(id) || !this.requirementMet(item)) return false;
    if (!this.playerState.spendSpecialCoins(item.price)) return false;
    this.purchased.add(id);
    this.changes$.next();
    this.persist();
    return true;
  }

  // ── Persistencia local ──────────────────────────────────────────────────────

  private async load(): Promise<void> {
    try {
      const saved = (await this.storage.get(STORAGE_KEY)) as string[] | null;
      if (Array.isArray(saved)) saved.forEach(id => this.purchased.add(id));
    } catch (e) {
      console.warn('[account-shop] no se pudo restaurar', e);
    }
    this.changes$.next();
  }

  private persist(): void { this.storage.set(STORAGE_KEY, [...this.purchased]); }

  // ── Cuenta (Supabase global_data.account.accountShop) ───────────────────────

  getSnapshot(): string[] { return [...this.purchased]; }

  /** Fusiona nube + local (Set monotónico, como los logros globales). */
  async restore(ids: string[] | null | undefined): Promise<void> {
    await this.loadPromise;
    if (!Array.isArray(ids)) return;
    ids.forEach(id => this.purchased.add(id));
    this.changes$.next();
    this.persist();
  }
}
