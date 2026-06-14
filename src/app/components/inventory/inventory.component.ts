import { Component, ElementRef, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { CdkDragDrop, CdkDragMove } from '@angular/cdk/drag-drop';
import { InventoryItem, InventoryService } from 'src/app/services/inventory.service';
import { InventoryUnlockService } from 'src/app/services/inventory-unlock.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { GatheringEquipmentService } from 'src/app/services/gathering-equipment.service';
import { TownChestService } from 'src/app/services/town-chest.service';
import { BuildShopService } from 'src/app/services/build-shop.service';
import { PanelStateService } from 'src/app/services/panel-state.service';
import { EquipmentPanelService } from 'src/app/services/equipment-panel.service';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
  standalone: false
})
export class InventoryComponent implements OnInit, OnDestroy {
  readonly NUMBER_OF_TABS = 4;
  readonly ROWS = 4;
  readonly COLUMNS = 5;
  activeTabIndex: number = 0;
  tabs: string[] = [];
  inventories: ((InventoryItem | null)[][])[] = [];
  selectedItem: { tabIndex: number; row: number; col: number } | null = null;

  splitMenuOpen: boolean = false;
  splitValue: number = 1;
  deleteModalOpen: boolean = false;

  equipmentSlotIds: string[] = [];
  /** IDs CDK a los que puede arrastrarse desde el inventario: slots de equipo + celdas del cofre. */
  connectedDropIds: string[] = [];
  detailPanelStyle: { [key: string]: string } = {};
  /** Comparador: panel gemelo, pegado a la izquierda del de info, con el equipo equipado equivalente. */
  comparePanelStyle: { [key: string]: string } = {};

  private saveTimer: any;
  private dropSub: Subscription;
  private removeSub: Subscription;
  private unlockSub: Subscription;
  private prevUnlocked = 0;

  private panelState = inject(PanelStateService);
  private equipPanel = inject(EquipmentPanelService);
  private playerState = inject(PlayerStateService);
  unlock = inject(InventoryUnlockService);

  coins$ = this.playerState.coins$;

  constructor(
    private inventoryService: InventoryService,
    public equipmentService: EquipmentService,
    private gatheringService: GatheringEquipmentService,
    private townChest: TownChestService,
    private buildShop: BuildShopService,
    private el: ElementRef,
  ) {}

  get selectedItemData(): InventoryItem | null {
    if (!this.selectedItem) return null;
    return this.inventories[this.selectedItem.tabIndex]?.[this.selectedItem.row]?.[this.selectedItem.col] ?? null;
  }

  /**
   * Slot equipable equivalente a un ítem: el primero ocupado que lo acepte (combate
   * o recolección), o el primero libre si ninguno está ocupado. null si no es equipable.
   */
  private targetSlotFor(item: InventoryItem): { kind: 'equip' | 'gather'; id: string; item: InventoryItem | null } | null {
    const key = item.category ?? item.name;
    const eq = this.equipmentService.slots.filter(s => s.accepts.includes(key));
    if (eq.length) { const s = eq.find(x => x.item) ?? eq[0]; return { kind: 'equip', id: s.id, item: s.item }; }
    const ga = this.gatheringService.slots.filter(s => s.accepts.includes(key));
    if (ga.length) { const s = ga.find(x => x.item) ?? ga[0]; return { kind: 'gather', id: s.id, item: s.item }; }
    return null;
  }

  /**
   * Ítem equipado equivalente al seleccionado, para el comparador. Devuelve null
   * (panel oculto) si: el equipo no está abierto en la pestaña de personaje, el
   * ítem no es equipable, o no hay nada equipado en su slot.
   */
  get compareItemData(): InventoryItem | null {
    if (!this.equipPanel.onCharacterEquipTab) return null;
    const sel = this.selectedItemData;
    if (!sel) return null;
    return this.targetSlotFor(sel)?.item ?? null;   // no equipable / sin nada equipado → nada
  }

  /** Equipa el ítem seleccionado en su slot equivalente; el desplazado vuelve a su celda. */
  equipSelected(): void {
    if (!this.selectedItem) return;
    const sel = this.selectedItemData;
    if (!sel) return;
    const target = this.targetSlotFor(sel);
    if (!target) return;
    const cdkId = (target.kind === 'equip' ? 'equip-' : 'gather-') + target.id;
    const displaced = target.kind === 'equip'
      ? this.equipmentService.equip(cdkId, sel)
      : this.gatheringService.equip(cdkId, sel);
    // El nuevo deja su celda; el equipado anterior ocupa ese hueco (o se vacía)
    const { tabIndex, row, col } = this.selectedItem;
    this.inventories[tabIndex][row][col] = displaced ?? null;
    this.selectedItem = null;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
    this.triggerSave();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.selectedItem = null;
    }
  }

  ngOnInit() {
    this.activeTabIndex = this.panelState.get('inv.tab', 0);
    // Si la pestaña guardada ya no está desbloqueada (p.ej. sin mochila), vuelve a la 1ª
    if (!this.unlock.isTabVisible(this.activeTabIndex)) this.activeTabIndex = 0;
    this.tabs = ['I', 'II', 'III', 'IV', 'V'].slice(0, this.NUMBER_OF_TABS);
    this.equipmentSlotIds = this.equipmentService.getEquipmentSlotIds();
    this.connectedDropIds = [...this.equipmentSlotIds, ...this.gatheringService.getSlotIds(), ...this.townChest.cellIds, ...this.buildShop.sellCellIds];

    // Grid vacío síncrono para que CDK registre los drop lists antes de cargar datos
    this.inventories = this.inventoryService.buildGrid();

    // Cargar datos reales (mock o Supabase)
    this.inventoryService.load().then(grid => {
      this.inventories = grid;
      // Por si se equipó una mochila menor con el inventario cerrado
      this.reconcileLockedItems();
    });

    // Recibir items recogidos del suelo en tiempo real
    this.dropSub = this.inventoryService.itemDropped$.subscribe(item => {
      this.addItemToInventory(item);
    });

    // Recibir solicitudes de borrado desde otros sistemas (p.ej. equipamiento)
    this.removeSub = this.inventoryService.removeRequest$.subscribe(({ tabIndex, row, col }) => {
      this.inventories[tabIndex][row][col] = null;
      this.triggerSave();
    });

    // Al cambiar la mochila equipada cambian las celdas/pestañas disponibles
    this.prevUnlocked = this.unlock.unlocked;
    this.unlockSub = this.unlock.unlocked$.subscribe(n => {
      // La mochila nueva tiene menos huecos → reubicar/soltar lo que se queda fuera
      if (n < this.prevUnlocked) this.reconcileLockedItems();
      this.prevUnlocked = n;
      if (!this.unlock.isTabVisible(this.activeTabIndex)) this.selectTab(0);
    });
  }

  ngOnDestroy() {
    clearTimeout(this.saveTimer);
    this.inventoryService.save(this.inventories);
    this.dropSub?.unsubscribe();
    this.removeSub?.unsubscribe();
    this.unlockSub?.unsubscribe();
  }

  // --- Desbloqueo por mochilas ---

  isCellUnlocked(tabIndex: number, row: number, col: number): boolean {
    return this.unlock.isUnlocked(tabIndex, row, col);
  }

  /** Items que quedaron en celdas ahora bloqueadas: se reubican; si no caben, al suelo. */
  private reconcileLockedItems(): void {
    const orphans: InventoryItem[] = [];
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (!this.unlock.isUnlocked(t, i, j) && this.inventories[t][i][j]) {
            orphans.push(this.inventories[t][i][j]!);
            this.inventories[t][i][j] = null;
          }
        }
      }
    }
    if (!orphans.length) return;
    for (const item of orphans) this.placeOrDropToWorld(item);
    this.triggerSave();
  }

  /** Coloca el item en un hueco desbloqueado (fusionando si aplica) o lo suelta al suelo. */
  private placeOrDropToWorld(item: InventoryItem): void {
    if (item.mergeable) {
      for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
        for (let i = 0; i < this.ROWS; i++) {
          for (let j = 0; j < this.COLUMNS; j++) {
            if (!this.unlock.isUnlocked(t, i, j)) continue;
            const existing = this.inventories[t][i][j];
            if (existing?.mergeable && existing.name === item.name) {
              existing.sum = (existing.sum ?? 0) + (item.sum ?? 1);
              return;
            }
          }
        }
      }
    }
    const cell = this.findFirstEmptyCell();
    if (cell) {
      this.inventories[cell.tabIndex][cell.row][cell.col] = item;
      return;
    }
    this.inventoryService.dropToWorld(item);
  }

  isTabVisible(tabIndex: number): boolean {
    return this.unlock.isTabVisible(tabIndex);
  }

  ngAfterViewInit() {
    document.addEventListener('dragover', (event) => event.preventDefault());
  }

  // --- Drag moved: activa tab si el puntero pasa por encima ---

  onDragMoved(event: CdkDragMove): void {
    const { x, y } = event.pointerPosition;
    const el = document.elementFromPoint(x, y) as HTMLElement;
    const tabEl = el?.closest('[data-tab-index]') as HTMLElement;
    if (!tabEl) return;
    const index = parseInt(tabEl.dataset['tabIndex']);
    if (!isNaN(index) && index !== this.activeTabIndex) {
      this.selectTab(index);
    }
  }

  // --- Tabs ---

  selectTab(index: number): void {
    this.activeTabIndex = index;
    this.panelState.set('inv.tab', index);
    this.selectedItem = null;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  // --- Selección ---

  selectItem(tabIndex: number, row: number, col: number, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.inventories[tabIndex][row][col]) return;

    const isSame =
      this.selectedItem?.tabIndex === tabIndex &&
      this.selectedItem?.row === row &&
      this.selectedItem?.col === col;

    this.selectedItem = isSame ? null : { tabIndex, row, col };

    if (this.selectedItem) {
      const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
      const detailRight = window.innerWidth - rect.left + 8;
      // bottom: 63px → alineado con la base del modal de inventario (footer + aire)
      this.detailPanelStyle = {
        top:    rect.top + 'px',
        right:  detailRight + 'px',
        bottom: '63px',
      };
      // Comparador pegado a la izquierda del de info: ancho del panel (170 + 24 padding
      // + 8 borde = 202px, content-box) + 10px de separación.
      // z-index por encima del modal de equipo (200) para que salga sobre él, no detrás.
      this.comparePanelStyle = {
        top:     rect.top + 'px',
        right:   (detailRight + 202 + 10) + 'px',
        bottom:  '63px',
        'z-index': '210',
      };
    }

    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  closeOverlays() {
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  // --- Drag & Drop ---

  onDrop(event: CdkDragDrop<any>, targetTabIndex: number, targetRow: number, targetCol: number): void {
    const data = event.item.data;

    // Drop desde un slot de equipamiento → inventario
    if (data.sourceContext === 'equipment') {
      const targetItem = this.inventories[targetTabIndex][targetRow][targetCol];
      if (targetItem !== null) return; // celda ocupada: rechazar
      this.inventories[targetTabIndex][targetRow][targetCol] = data.item;
      this.equipmentService.unequip(data.slotId);
      this.splitMenuOpen = false;
      this.deleteModalOpen = false;
      this.triggerSave();
      return;
    }

    // Drop desde un slot de recolección → inventario
    if (data.sourceContext === 'gathering') {
      const targetItem = this.inventories[targetTabIndex][targetRow][targetCol];
      if (targetItem !== null) return;
      this.inventories[targetTabIndex][targetRow][targetCol] = data.item;
      this.gatheringService.unequip(data.slotId);
      this.splitMenuOpen = false;
      this.deleteModalOpen = false;
      this.triggerSave();
      return;
    }

    // Drop desde el cofre de ciudad → inventario (retirar)
    if (data.sourceContext === 'chest') {
      const targetItem = this.inventories[targetTabIndex][targetRow][targetCol];
      const incoming: InventoryItem = data.item;

      if (targetItem?.mergeable && incoming.mergeable && targetItem.name === incoming.name) {
        targetItem.sum! += incoming.sum!;
      } else if (targetItem !== null) {
        return; // celda ocupada: rechazar
      } else {
        this.inventories[targetTabIndex][targetRow][targetCol] = incoming;
      }

      this.townChest.removeRequest$.next({
        tabIndex: data.tabIndex,
        row: data.row,
        col: data.col,
      });
      this.splitMenuOpen = false;
      this.deleteModalOpen = false;
      this.triggerSave();
      return;
    }

    // Drop desde el inventario de venta de la tienda → inventario (retirar)
    if (data.sourceContext === 'shop-sell') {
      const targetItem = this.inventories[targetTabIndex][targetRow][targetCol];
      const incoming: InventoryItem = data.item;

      if (targetItem?.mergeable && incoming.mergeable && targetItem.name === incoming.name) {
        targetItem.sum! += incoming.sum!;
      } else if (targetItem !== null) {
        return; // celda ocupada: rechazar
      } else {
        this.inventories[targetTabIndex][targetRow][targetCol] = incoming;
      }

      this.buildShop.requestSellRemove(data.row, data.col);
      this.splitMenuOpen = false;
      this.deleteModalOpen = false;
      this.triggerSave();
      return;
    }

    // Drop interno inventario → inventario
    const { tabIndex: srcTab, row: srcRow, col: srcCol, item: draggedItem } = data;
    if (srcTab === targetTabIndex && srcRow === targetRow && srcCol === targetCol) return;

    const targetItem = this.inventories[targetTabIndex][targetRow][targetCol];

    if (targetItem?.mergeable && draggedItem.mergeable && targetItem.name === draggedItem.name) {
      targetItem.sum! += draggedItem.sum!;
      this.inventories[srcTab][srcRow][srcCol] = null;
      if (this.selectedItem?.tabIndex === srcTab && this.selectedItem?.row === srcRow && this.selectedItem?.col === srcCol) {
        this.selectedItem = { tabIndex: targetTabIndex, row: targetRow, col: targetCol };
      }
    } else if (targetItem) {
      this.inventories[targetTabIndex][targetRow][targetCol] = draggedItem;
      this.inventories[srcTab][srcRow][srcCol] = targetItem;
      if (this.selectedItem?.tabIndex === srcTab && this.selectedItem?.row === srcRow && this.selectedItem?.col === srcCol) {
        this.selectedItem = { tabIndex: targetTabIndex, row: targetRow, col: targetCol };
      } else if (this.selectedItem?.tabIndex === targetTabIndex && this.selectedItem?.row === targetRow && this.selectedItem?.col === targetCol) {
        this.selectedItem = { tabIndex: srcTab, row: srcRow, col: srcCol };
      }
    } else {
      this.inventories[targetTabIndex][targetRow][targetCol] = draggedItem;
      this.inventories[srcTab][srcRow][srcCol] = null;
      if (this.selectedItem?.tabIndex === srcTab && this.selectedItem?.row === srcRow && this.selectedItem?.col === srcCol) {
        this.selectedItem = { tabIndex: targetTabIndex, row: targetRow, col: targetCol };
      }
    }

    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
    this.triggerSave();
  }

  // --- Split ---

  openSplitMenu(event: MouseEvent) {
    event.stopPropagation();
    if (!this.selectedItem) return;
    const { tabIndex, row, col } = this.selectedItem;
    const item = this.inventories[tabIndex][row][col];
    if (item?.mergeable && item.sum! > 1) {
      this.splitValue = 1;
      this.splitMenuOpen = true;
    } else {
      this.splitMenuOpen = false;
    }
  }

  increaseSplitValue() {
    if (!this.selectedItem) return;
    const { tabIndex, row, col } = this.selectedItem;
    const item = this.inventories[tabIndex][row][col];
    if (item && this.splitValue < item.sum! - 1) this.splitValue++;
  }

  decreaseSplitValue() {
    if (this.splitValue > 1) this.splitValue--;
  }

  executeSplit(event: MouseEvent) {
    event.stopPropagation();
    if (!this.selectedItem) return;
    const { tabIndex, row, col } = this.selectedItem;
    const item = this.inventories[tabIndex][row][col];
    if (!item?.mergeable || item.sum! <= 1 || this.splitValue >= item.sum!) return;

    const emptyCell = this.findFirstEmptyCell();
    if (!emptyCell) return;

    item.sum! -= this.splitValue;
    this.inventories[emptyCell.tabIndex][emptyCell.row][emptyCell.col] = {
      id: this.inventoryService.generateId(),
      name: item.name,
      icon: item.icon,
      mergeable: item.mergeable,
      sum: this.splitValue,
      order: item.order
    };
    this.splitMenuOpen = false;
    this.triggerSave();
  }

  // --- Borrar ---

  openDeleteModal(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedItem) {
      this.deleteModalOpen = true;
      this.splitMenuOpen = false;
    }
  }

  confirmDelete(event: MouseEvent) {
    event.stopPropagation();
    if (!this.selectedItem) return;
    const { tabIndex, row, col } = this.selectedItem;
    this.inventories[tabIndex][row][col] = null;
    this.selectedItem = null;
    this.deleteModalOpen = false;
    this.triggerSave();
  }

  cancelDelete(event: MouseEvent) {
    event.stopPropagation();
    this.deleteModalOpen = false;
  }

  // --- Ordenar ---

  sortInventory() {
    // Solo se reordenan las celdas desbloqueadas; las bloqueadas no se tocan
    const items: InventoryItem[] = [];
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (this.unlock.isUnlocked(t, i, j) && this.inventories[t][i][j]) items.push(this.inventories[t][i][j]!);
        }
      }
    }
    items.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });

    let index = 0;
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (!this.unlock.isUnlocked(t, i, j)) continue;
          this.inventories[t][i][j] = index < items.length ? items[index++] : null;
        }
      }
    }
    this.selectedItem = null;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
    this.triggerSave();
  }

  // --- Añadir item desde fuera ---

  public addItemToInventory(newItem: InventoryItem): void {
    if (newItem.mergeable) {
      for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
        for (let i = 0; i < this.ROWS; i++) {
          for (let j = 0; j < this.COLUMNS; j++) {
            if (!this.unlock.isUnlocked(t, i, j)) continue;
            const existing = this.inventories[t][i][j];
            if (existing?.mergeable && existing.name === newItem.name) {
              existing.sum! += newItem.sum!;
              this.triggerSave();
              return;
            }
          }
        }
      }
    }
    const emptyCell = this.findFirstEmptyCell();
    if (emptyCell) {
      this.inventories[emptyCell.tabIndex][emptyCell.row][emptyCell.col] = newItem;
      this.triggerSave();
    } else {
      console.error('[Inventory] No hay espacio disponible');
    }
  }

  // --- Utilidades ---

  private findFirstEmptyCell(): { tabIndex: number; row: number; col: number } | null {
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (this.unlock.isUnlocked(t, i, j) && !this.inventories[t][i][j]) return { tabIndex: t, row: i, col: j };
        }
      }
    }
    return null;
  }

  private triggerSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.inventoryService.save(this.inventories), 2000);
  }

  getSheetPos(frame: number = 0, cols: number = 12, frameSize: number = 32, contentSize?: number): string {
    const cs    = contentSize ?? frameSize;
    const scale = 32 / cs;
    const col   = frame % cols;
    const row   = Math.floor(frame / cols);
    return `-${col * frameSize * scale}px -${row * frameSize * scale}px`;
  }

  getSheetBgSize(cols: number = 12, frameSize: number = 32, contentSize?: number): string {
    const cs = contentSize ?? frameSize;
    return `${cols * frameSize * (32 / cs)}px auto`;
  }
}
