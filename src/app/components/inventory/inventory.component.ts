import { Component, OnInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

interface InventoryItem {
  id: number;
  name: string;
  // Otras propiedades (imagen, descripción, etc.) se pueden agregar según convenga.
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'], 
  standalone: false
})
export class InventoryComponent implements OnInit {
  rows = 4;
  columns = 5;
  grid: (InventoryItem | null)[][] = [];
  dropListIds: string[] = [];

  ngOnInit() {
    // Genera la matriz de 4 filas x 5 columnas y almacena los ids de cada celda.
    for (let i = 0; i < this.rows; i++) {
      const row: (InventoryItem | null)[] = [];
      for (let j = 0; j < this.columns; j++) {
        row.push(null);
        this.dropListIds.push(`cell-${i}-${j}`);
      }
      this.grid.push(row);
    }

    // Ejemplo: se añaden algunos objetos al inventario.
    this.grid[0][0] = { id: 1, name: 'Espada' };
    this.grid[0][1] = { id: 2, name: 'Escudo' };
    this.grid[1][0] = { id: 3, name: 'Poción' };
  }

  /**
   * Maneja el evento de soltar (drop) un objeto en una celda.
   * Si la celda destino está vacía se mueve el objeto, y si ya tiene un objeto, se intercambian.
   */
  onDrop(event: CdkDragDrop<any>, targetRow: number, targetCol: number) {
    const draggedData = event.item.data; // { row: number, col: number, item: InventoryItem }
    const sourceRow = draggedData.row;
    const sourceCol = draggedData.col;

    // Si soltamos en la misma celda, no se hace nada.
    if (sourceRow === targetRow && sourceCol === targetCol) {
      return;
    }

    // Guarda temporalmente el objeto que ya existe (puede ser null).
    const targetItem = this.grid[targetRow][targetCol];

    // Coloca el item arrastrado en la celda destino.
    this.grid[targetRow][targetCol] = draggedData.item;
    // Coloca el item destino (o null) en la celda origen.
    this.grid[sourceRow][sourceCol] = targetItem;
    
    // Opcional: Si por alguna razón Angular no detecta los cambios (muy raro en este caso),
    // podrías forzar la detección reasignando la matriz:
    // this.grid = [...this.grid];
  }
}
