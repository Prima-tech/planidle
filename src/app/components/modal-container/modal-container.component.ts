// modal-container.component.ts
import { Component, ComponentRef, Input, ViewChild, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-modal-container',
  templateUrl: './modal-container.component.html',
  styleUrls: ['./modal-container.component.scss'],
  standalone: false
})
export class ModalContainerComponent {
  @ViewChild('modalContent', { read: ViewContainerRef }) modalContent!: ViewContainerRef;
  
  isOpen = false;

  type: string;

  open(component: any, type: string) {
    this.type = type;
    this.isOpen = true;
    setTimeout(() => {
      this.modalContent.clear();
      this.modalContent.createComponent(component);
    });
  }

  close() {
    this.modalContent.clear();
    this.isOpen = false;
  }

  isOpenModal() {
    return this.isOpen;
  }
}
