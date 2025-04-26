import { Component, OnInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

interface InventoryItem {
  id: number;
  name: string;
  mergeable?: boolean;
  sum?: number;
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
  standalone: false
  // NOTA: Este componente NO es standalone (standalone: false)
})
export class InventoryComponent implements OnInit {
  rows = 4;
  columns = 5;
  grid: (InventoryItem | null)[][] = [];
  dropListIds: string[] = [];

  // Para manejar la selección del item en la cuadrícula
  selectedItem: { row: number; col: number } | null = null;

  // Variables para la funcionalidad "Split"
  splitMenuOpen: boolean = false;
  splitValue: number = 1;
  // Contador para asignar nuevos IDs (ya hay items con id 1 al 5)
  nextId: number = 6;

  ngOnInit() {
    // Inicializa la cuadrícula y los identificadores de cada celda
    for (let i = 0; i < this.rows; i++) {
      const row: (InventoryItem | null)[] = [];
      for (let j = 0; j < this.columns; j++) {
        row.push(null);
        this.dropListIds.push(`cell-${i}-${j}`);
      }
      this.grid.push(row);
    }

    // Items no mergeables
    this.grid[0][0] = { id: 1, name: 'Espada', mergeable: false };
    this.grid[0][1] = { id: 2, name: 'Escudo', mergeable: false };
    this.grid[1][0] = { id: 3, name: 'Poción', mergeable: false };

    // Dos items mergeables llamados "Hierro" con atributo sum (2 y 3)
    this.grid[2][2] = { id: 4, name: 'Hierro', mergeable: true, sum: 2 };
    this.grid[2][3] = { id: 5, name: 'Hierro', mergeable: true, sum: 3 };
  }

  /**
   * Al hacer clic en un item, se selecciona (o se deselecciona si ya estaba seleccionado).
   * Se usa event.stopPropagation() para evitar que otros listeners (por ejemplo, para cerrar el menú split) interfieran.
   */
  selectItem(row: number, col: number, event: MouseEvent) {
    event.stopPropagation();
    if (this.grid[row][col]) {
      // Si se hace clic en el mismo item, se deselecciona y se cierra el menú.
      if (this.selectedItem && this.selectedItem.row === row && this.selectedItem.col === col) {
        this.selectedItem = null;
        this.splitMenuOpen = false;
      } else {
        // Al seleccionar otro item, se actualiza la selección y se oculta el menú de split.
        this.selectedItem = { row, col };
        this.splitMenuOpen = false;
      }
    }
  }
  

  /**
   * Evento del drop de un item en una celda.  
   * Realiza movimiento, swap o merge según convenga.
   */
  onDrop(event: CdkDragDrop<any>, targetRow: number, targetCol: number) {
    const draggedData = event.item.data; // { row, col, item }
    const sourceRow = draggedData.row;
    const sourceCol = draggedData.col;
    const draggedItem = draggedData.item;

    // Evitar acción si se suelta en la misma celda
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
        // Actualiza la selección si fuese necesaria
        if (this.selectedItem && this.selectedItem.row === sourceRow && this.selectedItem.col === sourceCol) {
          this.selectedItem = { row: targetRow, col: targetCol };
        }
      } else {
        // Intercambio
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
      // Movimiento a celda vacía
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
    // Al mover o interactuar con el inventario se cierra el menú de split (si estuviera abierto)
    this.splitMenuOpen = false;
  }

  /**
   * Abre el menú split si se tiene un item seleccionado
   * que sea mergeable y tenga sum > 1.
   */
  openSplitMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedItem) {
      const { row, col } = this.selectedItem;
      const item = this.grid[row][col];
      if (item && item.mergeable && item.sum! > 1) {
        this.splitValue = 1; // valor inicial
        this.splitMenuOpen = true;
      } else {
        this.splitMenuOpen = false;
      }
    }
  }

  /**
   * Busca la primera celda vacía (null) en la cuadrícula.
   * Devuelve un objeto con las coordenadas si se encuentra, o null de lo contrario.
   */
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

  /**
   * Aumenta el valor a dividir (máximo: sum del item - 1).
   */
  increaseSplitValue() {
    if (this.selectedItem) {
      const { row, col } = this.selectedItem;
      const item = this.grid[row][col];
      if (item && typeof item.sum === 'number' && this.splitValue < item.sum - 1) {
        this.splitValue++;
      }
    }
  }

  /**
   * Disminuye el valor a dividir (mínimo: 1).
   */
  decreaseSplitValue() {
    if (this.splitValue > 1) {
      this.splitValue--;
    }
  }

  /**
   * Ejecuta la acción de "split":  
   * - Se verifica que exista una celda vacía en el inventario.  
   * - Se crea un nuevo item (con nuevo id y con sum = splitValue) en la primera celda vacía
   * - Al item original se le resta splitValue.
   */
  executeSplit(event: MouseEvent) {
    event.stopPropagation();
    if (!this.selectedItem) {
      return;
    }
    const { row, col } = this.selectedItem;
    const item = this.grid[row][col];
    if (item && item.mergeable && typeof item.sum === 'number' && item.sum > 1 && this.splitValue < item.sum) {
      const emptyCell = this.findFirstEmptyCell();
      if (!emptyCell) {
        // Inventario completo: no se puede dividir
        return;
      }
      // Resta al item original el valor de split
      item.sum -= this.splitValue;
      // Crea el nuevo item copiando las propiedades (puedes modificar si deseas copiar o no otras propiedades)
      const newItem: InventoryItem = {
        id: this.nextId++,
        name: item.name,
        mergeable: item.mergeable,
        sum: this.splitValue
      };
      // Coloca el nuevo item en la primera posición vacía
      this.grid[emptyCell.row][emptyCell.col] = newItem;
      // Cierra el menú split
      this.splitMenuOpen = false;
    }
  }

  /**
   * Cierra el menú split (por ejemplo, al hacer clic fuera de él).
   */
  closeSplitMenu() {
    this.splitMenuOpen = false;
  }
}
