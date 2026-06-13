import { Component, ElementRef, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { CdkDragDrop, CdkDragMove } from '@angular/cdk/drag-drop';
import { InventoryItem, InventoryService } from 'src/app/services/inventory.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { TownChestService } from 'src/app/services/town-chest.service';
import { PanelStateService } from 'src/app/services/panel-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-town-chest',
  templateUrl: './town-chest.component.html',
  styleUrls: ['./town-chest.component.scss'],
  standalone: false
})
export class TownChestComponent implements OnInit, OnDestroy {
  readonly NUMBER_OF_TABS = 4;
  readonly ROWS = 4;
  readonly COLUMNS = 5;
  activeTabIndex: number = 0;
  tabs: string[] = [];
  chest: ((InventoryItem | null)[][])[] = [];
  selectedItem: { tabIndex: number; row: number; col: number } | null = null;

  splitMenuOpen: boolean = false;
  splitValue: number = 1;
  deleteModalOpen: boolean = false;

  /** Celdas del inventario del personaje a las que el cofre permite arrastrar. */
  inventoryCellIds: string[] = [];
  detailPanelStyle: { [key: string]: string } = {};

  private saveTimer: any;
  private removeSub: Subscription;

  private panelState = inject(PanelStateService);
  private equipmentService = inject(EquipmentService);

  constructor(
    private townChest: TownChestService,
    private inventoryService: InventoryService,
    private el: ElementRef,
  ) {}

  get selectedItemData(): InventoryItem | null {
    if (!this.selectedItem) return null;
    return this.chest[this.selectedItem.tabIndex]?.[this.selectedItem.row]?.[this.selectedItem.col] ?? null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.selectedItem = null;
    }
  }

  ngOnInit() {
    this.activeTabIndex = this.panelState.get('chest.tab', 0);
    this.tabs = ['I', 'II', 'III', 'IV', 'V'].slice(0, this.NUMBER_OF_TABS);
    this.inventoryCellIds = this.equipmentService.inventoryCellIds;

    // Grid vacío síncrono para que CDK registre los drop lists antes de cargar datos
    this.chest = this.townChest.buildGrid();

    // Cargar el cofre compartido
    this.townChest.load().then(grid => {
      this.chest = grid;
    });

    // Cuando el inventario retira un item del cofre, vaciar esa celda
    this.removeSub = this.townChest.removeRequest$.subscribe(({ tabIndex, row, col }) => {
      this.chest[tabIndex][row][col] = null;
      this.triggerSave();
    });
  }

  ngOnDestroy() {
    clearTimeout(this.saveTimer);
    this.townChest.save(this.chest);
    this.removeSub?.unsubscribe();
  }

  ngAfterViewInit() {
    document.addEventListener('dragover', (event) => event.preventDefault());
  }

  // --- Drag moved: activa tab si el puntero pasa por encima ---

  onDragMoved(event: CdkDragMove): void {
    const { x, y } = event.pointerPosition;
    const el = document.elementFromPoint(x, y) as HTMLElement;
    const tabEl = el?.closest('[data-chest-tab-index]') as HTMLElement;
    if (!tabEl) return;
    const index = parseInt(tabEl.dataset['chestTabIndex']);
    if (!isNaN(index) && index !== this.activeTabIndex) {
      this.selectTab(index);
    }
  }

  // --- Tabs ---

  selectTab(index: number): void {
    this.activeTabIndex = index;
    this.panelState.set('chest.tab', index);
    this.selectedItem = null;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  // --- Selección ---

  selectItem(tabIndex: number, row: number, col: number, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.chest[tabIndex][row][col]) return;

    const isSame =
      this.selectedItem?.tabIndex === tabIndex &&
      this.selectedItem?.row === row &&
      this.selectedItem?.col === col;

    this.selectedItem = isSame ? null : { tabIndex, row, col };

    if (this.selectedItem) {
      const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
      this.detailPanelStyle = {
        top:    rect.top + 'px',
        left:   (rect.right + 8) + 'px',
        bottom: '56px',
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

    // Drop desde el inventario del personaje → cofre (depositar)
    if (data.sourceContext === 'inventory') {
      const targetItem = this.chest[targetTabIndex][targetRow][targetCol];
      const draggedItem: InventoryItem = data.item;

      if (targetItem?.mergeable && draggedItem.mergeable && targetItem.name === draggedItem.name) {
        targetItem.sum! += draggedItem.sum!;
      } else if (targetItem !== null) {
        return; // celda ocupada: rechazar
      } else {
        this.chest[targetTabIndex][targetRow][targetCol] = draggedItem;
      }

      // Quitar del inventario
      this.inventoryService.removeRequest$.next({
        tabIndex: data.tabIndex,
        row: data.row,
        col: data.col,
      });
      this.splitMenuOpen = false;
      this.deleteModalOpen = false;
      this.triggerSave();
      return;
    }

    // Drop interno cofre → cofre
    const { tabIndex: srcTab, row: srcRow, col: srcCol, item: draggedItem } = data;
    if (srcTab === targetTabIndex && srcRow === targetRow && srcCol === targetCol) return;

    const targetItem = this.chest[targetTabIndex][targetRow][targetCol];

    if (targetItem?.mergeable && draggedItem.mergeable && targetItem.name === draggedItem.name) {
      targetItem.sum! += draggedItem.sum!;
      this.chest[srcTab][srcRow][srcCol] = null;
      if (this.selectedItem?.tabIndex === srcTab && this.selectedItem?.row === srcRow && this.selectedItem?.col === srcCol) {
        this.selectedItem = { tabIndex: targetTabIndex, row: targetRow, col: targetCol };
      }
    } else if (targetItem) {
      this.chest[targetTabIndex][targetRow][targetCol] = draggedItem;
      this.chest[srcTab][srcRow][srcCol] = targetItem;
      if (this.selectedItem?.tabIndex === srcTab && this.selectedItem?.row === srcRow && this.selectedItem?.col === srcCol) {
        this.selectedItem = { tabIndex: targetTabIndex, row: targetRow, col: targetCol };
      } else if (this.selectedItem?.tabIndex === targetTabIndex && this.selectedItem?.row === targetRow && this.selectedItem?.col === targetCol) {
        this.selectedItem = { tabIndex: srcTab, row: srcRow, col: srcCol };
      }
    } else {
      this.chest[targetTabIndex][targetRow][targetCol] = draggedItem;
      this.chest[srcTab][srcRow][srcCol] = null;
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
    const item = this.chest[tabIndex][row][col];
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
    const item = this.chest[tabIndex][row][col];
    if (item && this.splitValue < item.sum! - 1) this.splitValue++;
  }

  decreaseSplitValue() {
    if (this.splitValue > 1) this.splitValue--;
  }

  executeSplit(event: MouseEvent) {
    event.stopPropagation();
    if (!this.selectedItem) return;
    const { tabIndex, row, col } = this.selectedItem;
    const item = this.chest[tabIndex][row][col];
    if (!item?.mergeable || item.sum! <= 1 || this.splitValue >= item.sum!) return;

    const emptyCell = this.findFirstEmptyCell();
    if (!emptyCell) return;

    item.sum! -= this.splitValue;
    this.chest[emptyCell.tabIndex][emptyCell.row][emptyCell.col] = {
      id: this.townChest.generateId(),
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
    this.chest[tabIndex][row][col] = null;
    this.selectedItem = null;
    this.deleteModalOpen = false;
    this.triggerSave();
  }

  cancelDelete(event: MouseEvent) {
    event.stopPropagation();
    this.deleteModalOpen = false;
  }

  // --- Ordenar ---

  sortChest() {
    const items: InventoryItem[] = [];
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (this.chest[t][i][j]) items.push(this.chest[t][i][j]!);
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
          this.chest[t][i][j] = index < items.length ? items[index++] : null;
        }
      }
    }
    this.selectedItem = null;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
    this.triggerSave();
  }

  // --- Utilidades ---

  private findFirstEmptyCell(): { tabIndex: number; row: number; col: number } | null {
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (!this.chest[t][i][j]) return { tabIndex: t, row: i, col: j };
        }
      }
    }
    return null;
  }

  private triggerSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.townChest.save(this.chest), 2000);
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
