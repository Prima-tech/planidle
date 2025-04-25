import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
  standalone: false,
})
export class InventoryComponent  implements OnInit {

   @Input() items = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  
    drop(event: CdkDragDrop<string[]>) {
      moveItemInArray(this.items, event.previousIndex, event.currentIndex);
    }

    boxSize = 0;

  constructor() {
    this.boxSize = ((window.innerWidth - 70)  / 5);
   }

  ngOnInit() {}


    

}

