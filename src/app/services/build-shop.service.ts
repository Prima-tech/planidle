import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { StorageService } from './storage.service';
import { PlayerStateService } from './player-state.service';
import { InventoryService, InventoryItem } from './inventory.service';
import { ITEM_CATALOG, LootEntry } from '../physics/griddrops';

/**
 * Tienda construible (edificio `shop`). Tiene su propio oro (compartido entre
 * personajes, persistido en una clave global) y un nº fijo de slots de venta.
 * Comprar descuenta el oro del jugador, mete el item en su inventario, baja el
 * stock y suma el precio al oro de la tienda.
 */
export interface ShopSaleItem {
  id: string;
  entry: LootEntry;     // item que se entrega al comprar
  price: number;        // precio en oro
  stock: number;        // unidades disponibles
  initialStock: number; // stock con el que arranca (para el reset)
}

const STORAGE_KEY  = 'build_shop';
const INITIAL_GOLD = 500;
const SLOT_COUNT   = 6;

/** Dimensiones del inventario de venta (donde arrastras items para venderlos). */
export const SELL_ROWS = 3;
export const SELL_COLS = 4;

/** Productos a la venta (por nombre del item en ITEM_CATALOG). */
const PRODUCTS: { id: string; itemName: string; price: number; initialStock: number }[] = [
  { id: 'bag1', itemName: 'Bolsa de Cuero', price: 100, initialStock: 1 },
  { id: 'wood', itemName: 'Madera',         price: 10,  initialStock: 10 },
];

/** Oro que paga la tienda por unidad al vender (por nombre). Fallback: DEFAULT. */
const DEFAULT_SELL_VALUE = 3;
const SELL_VALUES: Record<string, number> = {
  'Madera':            5,
  'Bolsa de Cuero':    50,
  'Poción':            4,
  'Yelmo de Hierro':   20,
  'Yelmo de Plata':    25,
  'Casco de Cuero':    12,
  'Capacete de Cuero': 18,
  'Coraza de Marfil':    18,
  'Coraza de Obsidiana': 35,
  'Coraza de Cobalto':   28,
  'Coraza Dorada':       32,
  'Botas de Marfil':     10,
  'Botas de Amatista':   16,
  'Botas Carmesí':       14,
  'Botas de Cobalto':    18,
  'Grebas de Cuero':     12,
  'Grebas de Obsidiana': 26,
  'Grebas Doradas':      20,
  'Grebas de Cobalto':   22,
};

@Injectable({ providedIn: 'root' })
export class BuildShopService {

  /** Oro de la tienda (no el del jugador). */
  readonly gold$ = new BehaviorSubject<number>(INITIAL_GOLD);
  /** 6 slots de venta; los vacíos son null. */
  readonly slots: (ShopSaleItem | null)[] = this.buildSlots();

  readonly SELL_ROWS = SELL_ROWS;
  readonly SELL_COLS = SELL_COLS;
  /** IDs CDK de las celdas del inventario de venta (`shop-sell-{r}-{c}`). */
  readonly sellCellIds: string[] = (() => {
    const ids: string[] = [];
    for (let r = 0; r < SELL_ROWS; r++) for (let c = 0; c < SELL_COLS; c++) ids.push(`shop-sell-${r}-${c}`);
    return ids;
  })();
  /** El inventario pide vaciar una celda de venta (al arrastrar un item de vuelta). */
  readonly sellRemoveRequest$ = new Subject<{ row: number; col: number }>();

  private storage     = inject(StorageService);
  private playerState = inject(PlayerStateService);
  private inventory   = inject(InventoryService);
  private loaded = false;

  private buildSlots(): (ShopSaleItem | null)[] {
    const slots: (ShopSaleItem | null)[] = Array(SLOT_COUNT).fill(null);
    PRODUCTS.forEach((p, i) => {
      if (i >= SLOT_COUNT) return;
      const entry = ITEM_CATALOG.find(e => e.name === p.itemName);
      if (entry) {
        slots[i] = { id: p.id, entry, price: p.price, stock: p.initialStock, initialStock: p.initialStock };
      }
    });
    return slots;
  }

  /** Carga (una vez) el oro y el stock guardados (clave global, compartida). */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const saved = (await this.storage.get(STORAGE_KEY)) as { gold: number; stock: Record<string, number> } | null;
    if (saved) {
      this.gold$.next(saved.gold ?? INITIAL_GOLD);
      for (const slot of this.slots) {
        if (slot && saved.stock?.[slot.id] != null) slot.stock = saved.stock[slot.id];
      }
    }
  }

  canBuy(item: ShopSaleItem): boolean {
    return item.stock > 0 && this.playerState.snapshot().coins >= item.price;
  }

  /** Compra `qty` unidades: -oro jugador, +items al inventario (o al suelo si está
   *  lleno), -stock, +oro tienda. Items apilables van en una pila de `qty`. */
  buy(item: ShopSaleItem, qty = 1): boolean {
    qty = Math.min(Math.max(1, Math.floor(qty)), item.stock);
    if (qty < 1) return false;
    const total = item.price * qty;
    if (this.playerState.snapshot().coins < total) return false;

    this.playerState.addCoins(-total);                // gasta (no cuenta como "recogido")
    if (item.entry.mergeable) {
      const inv = this.toInventoryItem(item.entry);
      inv.sum = qty;                                  // pila de qty unidades
      this.inventory.addOrDropToWorld(inv);
    } else {
      for (let i = 0; i < qty; i++) {
        this.inventory.addOrDropToWorld(this.toInventoryItem(item.entry));
      }
    }
    item.stock -= qty;
    this.gold$.next(this.gold$.value + total);        // la tienda cobra
    this.persist();
    return true;
  }

  /** Oro que paga la tienda por un item (× cantidad si es apilable). */
  sellValue(item: InventoryItem): number {
    const per = SELL_VALUES[item.name] ?? DEFAULT_SELL_VALUE;
    return per * (item.sum ?? 1);
  }

  /** ¿La tienda tiene oro suficiente para pagar `total`? */
  canSell(total: number): boolean {
    return total > 0 && this.gold$.value >= total;
  }

  /** Vende: la tienda paga `total` al jugador desde su oro. */
  sell(total: number): boolean {
    if (!this.canSell(total)) return false;
    this.gold$.next(this.gold$.value - total);   // la tienda paga
    this.playerState.addCoins(total);            // el jugador cobra
    this.persist();
    return true;
  }

  /** El inventario pide vaciar una celda de venta (item arrastrado de vuelta). */
  requestSellRemove(row: number, col: number): void {
    this.sellRemoveRequest$.next({ row, col });
  }

  /** Restablece la tienda: oro a 500 y stock inicial (llamado en "borrar todo"). */
  async reset(): Promise<void> {
    this.gold$.next(INITIAL_GOLD);
    for (const slot of this.slots) if (slot) slot.stock = slot.initialStock;
    this.loaded = true;
    await this.storage.remove(STORAGE_KEY);
  }

  private persist(): void {
    const stock: Record<string, number> = {};
    for (const slot of this.slots) if (slot) stock[slot.id] = slot.stock;
    this.storage.set(STORAGE_KEY, { gold: this.gold$.value, stock });
  }

  private toInventoryItem(e: LootEntry): InventoryItem {
    return {
      id: `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: e.name,
      category: e.category,
      icon: e.icon,
      iconSheet: e.iconSheet,
      iconFrame: e.iconFrame,
      iconFrameSize: e.iconFrameSize,
      iconFrameCols: e.iconFrameCols,
      iconContentSize: e.iconContentSize,
      mergeable: e.mergeable,
      sum: e.mergeable ? 1 : undefined,
      order: e.order,
      description: e.description,
      stats: e.stats,
      inventorySlots: e.inventorySlots,
    };
  }
}
