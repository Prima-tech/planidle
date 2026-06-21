import { Component, ElementRef, inject, OnDestroy, OnInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { BuildShopService, ShopSaleItem } from 'src/app/services/build-shop.service';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { InventoryService, InventoryItem } from 'src/app/services/inventory.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { STAT_LABELS, isPercentStat } from 'src/app/components/item-detail/item-detail.component';
import { Subscription } from 'rxjs';

/**
 * Ventana de la tienda construible. Dos pestañas:
 *  - Comprar: slots de venta de la tienda + panel de detalle con el botón Comprar.
 *  - Vender: inventario de venta donde arrastras items de tu mochila; el botón
 *    Vender muestra el oro que te dan y, al aceptar, te paga y los items desaparecen.
 * Abajo, el oro de la tienda (misma maquetación que el oro del inventario).
 */
@Component({
  selector: 'app-build-shop',
  templateUrl: './build-shop.component.html',
  styleUrls: ['./build-shop.component.scss'],
  standalone: false,
})
export class BuildShopComponent implements OnInit, OnDestroy {
  private buildShop   = inject(BuildShopService);
  private playerState = inject(PlayerStateService);
  private inventory   = inject(InventoryService);
  private equipment   = inject(EquipmentService);
  private el          = inject(ElementRef);

  readonly slots        = this.buildShop.slots;
  readonly shopGold$    = this.buildShop.gold$;
  readonly playerCoins$ = this.playerState.coins$;

  /** Nº de items reales en venta (slots no vacíos). Con más de 6 → slider horizontal. */
  get itemCount(): number { return this.slots.filter(s => !!s).length; }

  /** Pestaña activa. */
  tab: 'buy' | 'sell' = 'buy';

  // ── Comprar ──────────────────────────────────────────────────────────────
  selected: ShopSaleItem | null = null;
  quantity = 1;
  detailStyle: Record<string, string> = {};

  // Arrastre del slider con ratón (el dedo usa el scroll nativo, ver touch-action).
  private dragEl: HTMLElement | null = null;
  private dragStartX = 0;
  private dragStartScroll = 0;
  private dragMoved = false;

  // ── Vender ───────────────────────────────────────────────────────────────
  readonly SELL_ROWS = this.buildShop.SELL_ROWS;
  readonly SELL_COLS = this.buildShop.SELL_COLS;
  /** Inventario de venta: items en espera de venderse. */
  sellGrid: (InventoryItem | null)[][] = this.buildSellGrid();
  /** IDs de celda del inventario a las que se puede arrastrar de vuelta. */
  inventoryCellIds: string[] = [];

  private sellRemoveSub: Subscription;

  ngOnInit(): void {
    this.buildShop.load();
    this.inventoryCellIds = this.equipment.inventoryCellIds;
    // El inventario retiró un item del grid de venta → vaciar esa celda.
    this.sellRemoveSub = this.buildShop.sellRemoveRequest$.subscribe(({ row, col }) => {
      this.sellGrid[row][col] = null;
    });
  }

  ngOnDestroy(): void {
    this.sellRemoveSub?.unsubscribe();
    // Items no vendidos vuelven a la mochila (o al suelo si no caben).
    for (const row of this.sellGrid) {
      for (const item of row) if (item) this.inventory.addDroppedItem(item);
    }
  }

  private buildSellGrid(): (InventoryItem | null)[][] {
    return Array.from({ length: this.buildShop.SELL_ROWS }, () =>
      Array<InventoryItem | null>(this.buildShop.SELL_COLS).fill(null),
    );
  }

  setTab(t: 'buy' | 'sell'): void {
    this.tab = t;
    this.selected = null;
  }

  // ── Comprar ──────────────────────────────────────────────────────────────

  select(item: ShopSaleItem): void {
    // Si el click viene de un arrastre del slider, ignóralo (no selecciones).
    if (this.dragMoved) { this.dragMoved = false; return; }
    this.selected = this.selected === item ? null : item;
    this.quantity = 1;
    if (this.selected) {
      const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
      this.detailStyle = { top: rect.top + 'px', left: (rect.right + 8) + 'px' };
    }
  }

  // ── Arrastre del slider (ratón) ────────────────────────────────────────────
  onSliderDown(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || this.itemCount <= 6) return;  // táctil = scroll nativo
    const el = e.currentTarget as HTMLElement;
    this.dragEl = el;
    this.dragStartX = e.clientX;
    this.dragStartScroll = el.scrollLeft;
    this.dragMoved = false;
    el.classList.add('dragging');
    try { el.setPointerCapture(e.pointerId); } catch { /* no soportado */ }
  }

  onSliderMove(e: PointerEvent): void {
    if (!this.dragEl) return;
    const dx = e.clientX - this.dragStartX;
    if (Math.abs(dx) > 4) this.dragMoved = true;
    this.dragEl.scrollLeft = this.dragStartScroll - dx;
  }

  onSliderUp(e: PointerEvent): void {
    if (!this.dragEl) return;
    this.dragEl.classList.remove('dragging');
    try { this.dragEl.releasePointerCapture(e.pointerId); } catch { /* no soportado */ }
    this.dragEl = null;
  }

  closeDetail(): void { this.selected = null; }

  // ── Detalle de stats (mismo formato que app-item-detail del inventario) ────
  statLabel(key: string): string { return STAT_LABELS[key] ?? key; }
  isPercentStat(key: string): boolean { return isPercentStat(key); }

  stackable(item: ShopSaleItem): boolean { return !!item.entry.mergeable; }

  maxQty(item: ShopSaleItem, coins: number): number {
    const byCoins = Math.floor(coins / item.price);
    return Math.max(1, item.infinite ? byCoins : Math.min(item.stock, byCoins));
  }

  inc(item: ShopSaleItem, coins: number): void {
    if (this.quantity < this.maxQty(item, coins)) this.quantity++;
  }
  dec(): void { if (this.quantity > 1) this.quantity--; }

  private qtyFor(item: ShopSaleItem): number {
    return this.stackable(item) ? this.quantity : 1;
  }

  totalPrice(item: ShopSaleItem): number { return item.price * this.qtyFor(item); }

  affordable(item: ShopSaleItem, coins: number): boolean {
    const qty = this.qtyFor(item);
    return (item.infinite || item.stock >= qty) && coins >= item.price * qty;
  }

  buy(): void {
    if (!this.selected) return;
    this.buildShop.buy(this.selected, this.qtyFor(this.selected));
    // En infinitos el stock no baja: no limitamos la cantidad seleccionada por él.
    const cap = this.selected.infinite ? this.quantity : this.selected.stock;
    this.quantity = Math.max(1, Math.min(this.quantity, cap));
  }

  // ── Vender ───────────────────────────────────────────────────────────────

  onSellDrop(event: CdkDragDrop<any>, row: number, col: number): void {
    const data = event.item.data;

    // Desde la mochila → poner en venta (y retirar de la mochila)
    if (data.sourceContext === 'inventory') {
      const target   = this.sellGrid[row][col];
      const incoming: InventoryItem = data.item;
      if (target?.mergeable && incoming.mergeable && target.name === incoming.name) {
        target.sum! += incoming.sum!;
      } else if (target !== null) {
        return; // celda ocupada
      } else {
        this.sellGrid[row][col] = incoming;
      }
      this.inventory.removeRequest$.next({ tabIndex: data.tabIndex, row: data.row, col: data.col });
      return;
    }

    // Movimiento interno dentro del grid de venta
    if (data.sourceContext === 'shop-sell') {
      const { row: sr, col: sc, item } = data;
      if (sr === row && sc === col) return;
      const target = this.sellGrid[row][col];
      if (target?.mergeable && item.mergeable && target.name === item.name) {
        target.sum! += item.sum!;
        this.sellGrid[sr][sc] = null;
      } else if (target) {
        this.sellGrid[row][col] = item;
        this.sellGrid[sr][sc] = target;
      } else {
        this.sellGrid[row][col] = item;
        this.sellGrid[sr][sc] = null;
      }
    }
  }

  /** Oro total que dan por lo que hay en el grid de venta. */
  sellTotal(): number {
    let total = 0;
    for (const row of this.sellGrid) {
      for (const item of row) if (item) total += this.buildShop.sellValue(item);
    }
    return total;
  }

  hasSellItems(): boolean {
    return this.sellGrid.some(row => row.some(c => !!c));
  }

  canSell(): boolean {
    return this.hasSellItems() && this.buildShop.canSell(this.sellTotal());
  }

  confirmSell(): void {
    const total = this.sellTotal();
    if (!this.buildShop.sell(total)) return;
    this.sellGrid = this.buildSellGrid();   // los items vendidos desaparecen
  }

  // ── Iconos (mismo cálculo que inventario para sheets) ──────────────────────

  getSheetPos(frame = 0, cols = 12, frameSize = 32, contentSize?: number): string {
    const cs = contentSize ?? frameSize;
    const scale = 32 / cs;
    const c = frame % cols;
    const r = Math.floor(frame / cols);
    return `-${c * frameSize * scale}px -${r * frameSize * scale}px`;
  }

  getSheetBgSize(cols = 12, frameSize = 32, contentSize?: number): string {
    const cs = contentSize ?? frameSize;
    return `${cols * frameSize * (32 / cs)}px auto`;
  }
}
