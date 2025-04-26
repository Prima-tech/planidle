import { Component, OnInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

interface InventoryItem {
  id: number;
  name: string;
  mergeable?: boolean;
  sum?: number;
  order?: number;  // Nuevo campo para indicar el orden del item
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
  standalone: false
  // Por defecto, standalone es false (se declara de la forma tradicional)
})
export class InventoryComponent implements OnInit {
  rows = 4;
  columns = 5;
  grid: (InventoryItem | null)[][] = [];
  dropListIds: string[] = [];
  selectedItem: { row: number; col: number } | null = null;

  // Para el menú de Split
  splitMenuOpen: boolean = false;
  splitValue: number = 1;
  nextId: number = 6;

  // Para el modal de confirmación de borrado
  deleteModalOpen: boolean = false;

  ngOnInit() {
    // Inicialización de la cuadrícula y de los identificadores
    for (let i = 0; i < this.rows; i++) {
      const row: (InventoryItem | null)[] = [];
      for (let j = 0; j < this.columns; j++) {
        row.push(null);
        this.dropListIds.push(`cell-${i}-${j}`);
      }
      this.grid.push(row);
    }

    // Items de ejemplo (se les puede asignar un order manualmente)
    this.grid[0][0] = { id: 1, name: 'Espada', mergeable: false, order: 5 };
    this.grid[0][1] = { id: 2, name: 'Escudo', mergeable: false, order: 5 };
    this.grid[1][0] = { id: 3, name: 'Poción', mergeable: false, order: 3 };

    // Dos items mergeables llamados "Hierro" con atributo sum (y opcionalmente un order)
    this.grid[2][2] = { id: 4, name: 'Hierro', mergeable: true, sum: 2, order: 4 };
    this.grid[2][3] = { id: 5, name: 'Hierro', mergeable: true, sum: 3, order: 1 };
  }

  // Método para ordenar el inventario:
  sortInventory() {
    // Extraemos todos los items no nulos
    let items: InventoryItem[] = [];
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        if (this.grid[i][j] !== null) {
          items.push(this.grid[i][j]!);
        }
      }
    }

    // Ordenamos los items de la siguiente forma:
    // - Si ambos items tienen el campo 'order' definido, se usa ese valor.
    // - Si solo uno tiene 'order' definido, ese item se ordena primero.
    // - Si ninguno lo tiene, se ordena por nombre (y en caso de empate, por id).
    items.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      } else if (a.order !== undefined) {
        return -1;
      } else if (b.order !== undefined) {
        return 1;
      } else {
        return a.name.localeCompare(b.name) || a.id - b.id;
      }
    });

    // Rellenamos la cuadrícula en orden row-major con el array ordenado
    let index = 0;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        if (index < items.length) {
          this.grid[i][j] = items[index++];
        } else {
          this.grid[i][j] = null;
        }
      }
    }
    // Se cierran overlays y se deselecciona después de ordenar
    this.selectedItem = null;
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  // Al hacer clic en un item se selecciona y se cierran overlays abiertos
  selectItem(row: number, col: number, event: MouseEvent) {
    event.stopPropagation();
    if (this.grid[row][col]) {
      if (
        this.selectedItem &&
        this.selectedItem.row === row &&
        this.selectedItem.col === col
      ) {
        this.selectedItem = null;
        this.splitMenuOpen = false;
      } else {
        this.selectedItem = { row, col };
        this.splitMenuOpen = false;
        this.deleteModalOpen = false;
      }
    }
  }

  // Maneja el drop de un item: mueve, intercambia o funde (merge) según corresponda
  onDrop(event: CdkDragDrop<any>, targetRow: number, targetCol: number) {
    const draggedData = event.item.data; // { row, col, item }
    const sourceRow = draggedData.row;
    const sourceCol = draggedData.col;
    const draggedItem = draggedData.item;

    // Evita que se haga drop en la misma celda
    if (sourceRow === targetRow && sourceCol === targetCol) {
      return;
    }

    const targetItem = this.grid[targetRow][targetCol];
    if (targetItem) {
      if (
        targetItem.mergeable &&
        draggedItem.mergeable &&
        targetItem.name === draggedItem.name &&
        typeof targetItem.sum === 'number' &&
        typeof draggedItem.sum === 'number'
      ) {
        // Merge: suma los valores y elimina el item arrastrado
        targetItem.sum! += draggedItem.sum!;
        this.grid[sourceRow][sourceCol] = null;
        if (
          this.selectedItem &&
          this.selectedItem.row === sourceRow &&
          this.selectedItem.col === sourceCol
        ) {
          this.selectedItem = { row: targetRow, col: targetCol };
        }
      } else {
        // Intercambiamos los items
        this.grid[targetRow][targetCol] = draggedItem;
        this.grid[sourceRow][sourceCol] = targetItem;
        if (
          this.selectedItem &&
          this.selectedItem.row === sourceRow &&
          this.selectedItem.col === sourceCol
        ) {
          this.selectedItem = { row: targetRow, col: targetCol };
        } else if (
          this.selectedItem &&
          this.selectedItem.row === targetRow &&
          this.selectedItem.col === targetCol
        ) {
          this.selectedItem = { row: sourceRow, col: sourceCol };
        }
      }
    } else {
      // Mueve el item a una celda vacía
      this.grid[targetRow][targetCol] = draggedItem;
      this.grid[sourceRow][sourceCol] = null;
      if (
        this.selectedItem &&
        this.selectedItem.row === sourceRow &&
        this.selectedItem.col === sourceCol
      ) {
        this.selectedItem = { row: targetRow, col: targetCol };
      }
    }
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }

  // --- Funcionalidad Split ---
  openSplitMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedItem) {
      const { row, col } = this.selectedItem;
      const item = this.grid[row][col];
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
      const { row, col } = this.selectedItem;
      const item = this.grid[row][col];
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
  executeSplit(event: MouseEvent) {
    event.stopPropagation();
    if (!this.selectedItem) {
      return;
    }
    const { row, col } = this.selectedItem;
    const item = this.grid[row][col];
    if (
      item &&
      item.mergeable &&
      typeof item.sum === 'number' &&
      item.sum > 1 &&
      this.splitValue < item.sum
    ) {
      const emptyCell = this.findFirstEmptyCell();
      if (!emptyCell) {
        // Inventario lleno: no se puede dividir
        return;
      }
      item.sum -= this.splitValue;
      // Crea un nuevo item con un nuevo ID y con sum = splitValue
      const newItem: InventoryItem = {
        id: this.nextId++,
        name: item.name,
        mergeable: item.mergeable,
        sum: this.splitValue
      };
      this.grid[emptyCell.row][emptyCell.col] = newItem;
      this.splitMenuOpen = false;
    }
  }
  private findFirstEmptyCell(): { row: number; col: number } | null {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        if (this.grid[i][j] === null) {
          return { row: i, col: j };
        }
      }
    }
    return null;
  }

  // --- Funcionalidad Borrar ---
  openDeleteModal(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedItem) {
      this.deleteModalOpen = true;
      // Se cierra el menú split si está abierto
      this.splitMenuOpen = false;
    }
  }
  confirmDelete(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedItem) {
      const { row, col } = this.selectedItem;
      this.grid[row][col] = null;
      this.selectedItem = null;
      this.deleteModalOpen = false;
    }
  }
  cancelDelete(event: MouseEvent) {
    event.stopPropagation();
    this.deleteModalOpen = false;
  }


  // Al hacer clic de fondo se cierran ambos overlays
  closeOverlays() {
    this.splitMenuOpen = false;
    this.deleteModalOpen = false;
  }
}
