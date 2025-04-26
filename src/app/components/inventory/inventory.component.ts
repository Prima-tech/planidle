import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
  standalone: false
})
export class InventoryComponent implements OnInit {
  @Input() initialItems: any[] = [];

  inventorySize = 20;
  inventory: (any | null)[] = [];

  boxSize = 0;

  ngOnInit() {
    // Rellenamos el inventario con nulls si hay huecos
    this.inventory = Array(this.inventorySize).fill(null);
    for (let i = 0; i < this.initialItems.length; i++) {
      this.inventory[i] = this.initialItems[i];
    }

    this.boxSize = ((window.innerWidth - 70) / 5);
  }

  drop(event: CdkDragDrop<(any | null)[]>) {
    const from = event.previousIndex;
    const to = event.currentIndex;

    const temp = this.inventory[to];
    this.inventory[to] = this.inventory[from];
    this.inventory[from] = temp;
  }
}