import { Component, OnDestroy, OnInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { InventoryItem, InventoryService } from 'src/app/services/inventory.service';

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

  private saveTimer: any;

  constructor(private inventoryService: InventoryService) {}

  ngOnInit() {
    this.tabs = Array.from({ length: this.NUMBER_OF_TABS }, (_, i) => `Tab ${i + 1}`);

    // Grid vacío síncrono para que CDK registre los drop lists antes de cargar datos
    this.inventories = this.inventoryService.buildGrid();

    // Cargar datos reales (mock o Supabase)
    this.inventoryService.load().then(grid => {
      this.inventories = grid;
    });
  }

  ngOnDestroy() {
    // Guarda cualquier cambio pendiente al salir
    clearTimeout(this.saveTimer);
    this.inventoryService.save(this.inventories);
  }

  ngAfterViewInit() {
    document.addEventListener('dragover', (event) => event.preventDefault());
  }

  // --- Tabs ---

  selectTab(index: number): void {
    this.activeTabIndex = index;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  onTabEntered(event: any, index: number): void {
    if (this.activeTabIndex !== index) this.selectTab(index);
  }

  onTabDragEnter(index: number, event: DragEvent): void {
    event.preventDefault();
    this.selectTab(index);
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
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  closeOverlays() {
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  // --- Drag & Drop ---

  onDrop(event: CdkDragDrop<any>, targetTabIndex: number, targetRow: number, targetCol: number): void {
    const { tabIndex: srcTab, row: srcRow, col: srcCol, item: draggedItem } = event.item.data;

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
    const items: InventoryItem[] = [];
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (this.inventories[t][i][j]) items.push(this.inventories[t][i][j]!);
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
          if (!this.inventories[t][i][j]) return { tabIndex: t, row: i, col: j };
        }
      }
    }
    return null;
  }

  private triggerSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.inventoryService.save(this.inventories), 2000);
  }
}
