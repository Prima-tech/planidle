import { Component, HostListener, OnInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

interface InventoryItem {
  id: number;
  name: string;
  mergeable?: boolean;
  sum?: number;
  order?: number;
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
  standalone: false
  // Standalone: false (se declara de forma tradicional)
})
export class InventoryComponent implements OnInit {
  readonly NUMBER_OF_TABS = 4;
  readonly ROWS = 4;
  readonly COLUMNS = 5;
  activeTabIndex: number = 0;
  tabs: string[] = [];
  inventories: ((InventoryItem | null)[][])[] = [];
  globalDropListIds: string[] = [];
  selectedItem: { tabIndex: number; row: number; col: number } | null = null;

  // Funcionalidades extra (split, borrar, etc.)
  splitMenuOpen: boolean = false;
  splitValue: number = 1;
  nextId: number = 6;
  deleteModalOpen: boolean = false;

  ngOnInit() {
    // Inicializa las pestañas (por ejemplo, "Tab 1", "Tab 2", ...)
    this.tabs = Array.from({ length: this.NUMBER_OF_TABS }, (_, i) => `Tab ${i + 1}`);

    // Por cada pestaña, crea un inventario (matriz de ROWS x COLUMNS) y asigna IDs únicos a cada celda.
    for (let tab = 0; tab < this.NUMBER_OF_TABS; tab++) {
      let grid: (InventoryItem | null)[][] = [];
      for (let i = 0; i < this.ROWS; i++) {
        let row: (InventoryItem | null)[] = [];
        for (let j = 0; j < this.COLUMNS; j++) {
          row.push(null);
          this.globalDropListIds.push(`tab-${tab}-cell-${i}-${j}`);
        }
        grid.push(row);
      }
      this.inventories.push(grid);
    }

    // Ejemplo: poblar la pestaña 1 (índice 0)
    this.inventories[0][0][0] = { id: 1, name: 'Espada', mergeable: false, order: 2 };
    this.inventories[0][0][1] = { id: 2, name: 'Escudo', mergeable: false, order: 1 };
    this.inventories[0][1][0] = { id: 3, name: 'Poción', mergeable: false, order: 3 };
    this.inventories[0][2][2] = { id: 4, name: 'Hierro', mergeable: true, sum: 2, order: 4 };
    this.inventories[0][2][3] = { id: 5, name: 'Hierro', mergeable: true, sum: 3, order: 5 };
  }

  ngAfterViewInit() {
    document.addEventListener('dragover', (event) => {
      console.log('dragover event (manual listener)', event);
    });
  }


  selectTab(index: number): void {
    this.activeTabIndex = index;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  // Este método se dispara cuando un objeto arrastrable entra en la zona de una pestaña.
  onTabEntered(event: any, index: number): void {
    // Agregamos salida en consola para depurar.
    console.log(`cdkDropListEntered en Tab ${index}`, event);
    if (this.activeTabIndex !== index) {
      this.selectTab(index);
    }
  }

  // Nota: La directiva utiliza el evento cdkDropListEntered, que disparamos en la cabecera.
  // También se mantiene el resto de métodos: selectItem, onDrop, openSplitMenu, etc.

  // Por ejemplo, una versión simple de selectItem:
  selectItem(tabIndex: number, row: number, col: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.inventories[tabIndex][row][col]) {
      if (
        this.selectedItem &&
        this.selectedItem.tabIndex === tabIndex &&
        this.selectedItem.row === row &&
        this.selectedItem.col === col
      ) {
        this.selectedItem = null;
        this.splitMenuOpen = false;
      } else {
        this.selectedItem = { tabIndex, row, col };
        this.splitMenuOpen = false;
        this.deleteModalOpen = false;
      }
    }
  }

  // Y el método onDrop (similar a versiones anteriores) permanece...
  onDrop(
    event: CdkDragDrop<any>,
    targetTabIndex: number,
    targetRow: number,
    targetCol: number
  ): void {
    const draggedData = event.item.data; // { tabIndex, row, col, item }
    const sourceTabIndex = draggedData.tabIndex;
    const sourceRow = draggedData.row;
    const sourceCol = draggedData.col;
    const draggedItem = draggedData.item;

    if (
      sourceTabIndex === targetTabIndex &&
      sourceRow === targetRow &&
      sourceCol === targetCol
    ) {
      return;
    }

    const targetItem = this.inventories[targetTabIndex][targetRow][targetCol];
    if (targetItem) {
      // Comprobación de merge o swap (similar a versiones anteriores)
      if (
        targetItem.mergeable &&
        draggedItem.mergeable &&
        targetItem.name === draggedItem.name &&
        typeof targetItem.sum === 'number' &&
        typeof draggedItem.sum === 'number'
      ) {
        targetItem.sum! += draggedItem.sum!;
        this.inventories[sourceTabIndex][sourceRow][sourceCol] = null;
        if (
          this.selectedItem &&
          this.selectedItem.tabIndex === sourceTabIndex &&
          this.selectedItem.row === sourceRow &&
          this.selectedItem.col === sourceCol
        ) {
          this.selectedItem = { tabIndex: targetTabIndex, row: targetRow, col: targetCol };
        }
      } else {
        this.inventories[targetTabIndex][targetRow][targetCol] = draggedItem;
        this.inventories[sourceTabIndex][sourceRow][sourceCol] = targetItem;
        if (
          this.selectedItem &&
          this.selectedItem.tabIndex === sourceTabIndex &&
          this.selectedItem.row === sourceRow &&
          this.selectedItem.col === sourceCol
        ) {
          this.selectedItem = { tabIndex: targetTabIndex, row: targetRow, col: targetCol };
        } else if (
          this.selectedItem &&
          this.selectedItem.tabIndex === targetTabIndex &&
          this.selectedItem.row === targetRow &&
          this.selectedItem.col === targetCol
        ) {
          this.selectedItem = { tabIndex: sourceTabIndex, row: sourceRow, col: sourceCol };
        }
      }
    } else {
      this.inventories[targetTabIndex][targetRow][targetCol] = draggedItem;
      this.inventories[sourceTabIndex][sourceRow][sourceCol] = null;
      if (
        this.selectedItem &&
        this.selectedItem.tabIndex === sourceTabIndex &&
        this.selectedItem.row === sourceRow &&
        this.selectedItem.col === sourceCol
      ) {
        this.selectedItem = { tabIndex: targetTabIndex, row: targetRow, col: targetCol };
      }
    }
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  /* MÉTODOS PARA SPLIT (se mantienen iguales a versiones anteriores) */

  openSplitMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedItem) {
      const { tabIndex, row, col } = this.selectedItem;
      const item = this.inventories[tabIndex][row][col];
      if (item && item.mergeable && item.sum! > 1) {
        this.splitValue = 1;
        this.splitMenuOpen = true;
      } else {
        this.splitMenuOpen = false;
      }
    }
  }

  increaseSplitValue() {
    if (this.selectedItem) {
      const { tabIndex, row, col } = this.selectedItem;
      const item = this.inventories[tabIndex][row][col];
      if (item && typeof item.sum === 'number' && this.splitValue < item.sum - 1) {
        this.splitValue++;
      }
    }
  }

  decreaseSplitValue() {
    if (this.splitValue > 1) {
      this.splitValue--;
    }
  }

  private findFirstEmptyCell(): { tabIndex: number; row: number; col: number } | null {
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      let grid = this.inventories[t];
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (grid[i][j] === null) {
            return { tabIndex: t, row: i, col: j };
          }
        }
      }
    }
    return null;
  }

  executeSplit(event: MouseEvent) {
    event.stopPropagation();
    if (!this.selectedItem) {
      return;
    }
    const { tabIndex, row, col } = this.selectedItem;
    const item = this.inventories[tabIndex][row][col];
    if (item && item.mergeable && typeof item.sum === 'number' && item.sum > 1 && this.splitValue < item.sum) {
      const emptyCell = this.findFirstEmptyCell();
      if (!emptyCell) {
        return;
      }
      item.sum -= this.splitValue;
      const newItem: InventoryItem = {
        id: this.nextId++,
        name: item.name,
        mergeable: item.mergeable,
        sum: this.splitValue,
        order: item.order
      };
      this.inventories[emptyCell.tabIndex][emptyCell.row][emptyCell.col] = newItem;
      this.splitMenuOpen = false;
    }
  }

  /* MÉTODOS PARA BORRAR */

  openDeleteModal(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedItem) {
      this.deleteModalOpen = true;
      this.splitMenuOpen = false;
    }
  }

  confirmDelete(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedItem) {
      const { tabIndex, row, col } = this.selectedItem;
      this.inventories[tabIndex][row][col] = null;
      this.selectedItem = null;
      this.deleteModalOpen = false;
    }
  }

  cancelDelete(event: MouseEvent) {
    event.stopPropagation();
    this.deleteModalOpen = false;
  }

  /* MÉTODO ORDENAR: recolecta items de todas las pestañas, los ordena y los reubica */
  sortInventory() {
    let items: InventoryItem[] = [];
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      let grid = this.inventories[t];
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (grid[i][j] !== null) {
            items.push(grid[i][j]!);
          }
        }
      }
    }
    items.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      } else if (a.order !== undefined) {
        return -1;
      } else if (b.order !== undefined) {
        return 1;
      } else {
        const cmp = a.name.localeCompare(b.name);
        return cmp !== 0 ? cmp : a.id - b.id;
      }
    });
    let index = 0;
    for (let t = 0; t < this.NUMBER_OF_TABS; t++) {
      for (let i = 0; i < this.ROWS; i++) {
        for (let j = 0; j < this.COLUMNS; j++) {
          if (index < items.length) {
            this.inventories[t][i][j] = items[index++];
          } else {
            this.inventories[t][i][j] = null;
          }
        }
      }
    }
    this.selectedItem = null;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  closeOverlays() {
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  onTabDragEnter(index: number, event: DragEvent): void {
    // Evita la acción por defecto para asegurar que se dispare el evento
    event.preventDefault();
    // Activa la pestaña al entrar el objeto
    this.selectTab(index);
  }


  /**
   * Agrega un item al inventario.
   * Si el item es mergeable, busca en el inventario uno con el mismo nombre para fusionarlos (sumando sus sum).
   * Si no se encuentra o el item no es mergeable, se añade en la primera celda vacía.
   */
  public addItemToInventory(newItem: InventoryItem): void {
    // Si el item es mergeable, primero buscamos uno existente con el mismo nombre.
    if (newItem.mergeable) {
      for (let t = 0; t < this.inventories.length; t++) {
        const grid = this.inventories[t];
        for (let i = 0; i < grid.length; i++) {
          for (let j = 0; j < grid[i].length; j++) {
            const existingItem = grid[i][j];
            // Si hay un item y es mergeable y de mismo nombre, se fusiona.
            if (
              existingItem &&
              existingItem.mergeable &&
              existingItem.name === newItem.name &&
              typeof existingItem.sum === 'number' &&
              typeof newItem.sum === 'number'
            ) {
              existingItem.sum += newItem.sum;
              console.log(
                `Se fusionó el item "${newItem.name}" en la celda (${t}, ${i}, ${j}). Nuevo sum: ${existingItem.sum}`
              );
              return;
            }
          }
        }
      }
    }

    // Si llegó aquí, o el item no es mergeable o no se encontró uno para fusionar, se ingresa un item nuevo.
    const emptyCell = this.findFirstEmptyCell();
    if (emptyCell !== null) {
      this.inventories[emptyCell.tabIndex][emptyCell.row][emptyCell.col] = newItem;
      console.log(
        `Se agregó el item "${newItem.name}" en la celda (${emptyCell.tabIndex}, ${emptyCell.row}, ${emptyCell.col}).`
      );
    } else {
      console.error("No hay espacio disponible en el inventario para agregar el item.");
    }
  }
  
}
