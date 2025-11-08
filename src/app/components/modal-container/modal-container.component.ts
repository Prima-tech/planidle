// modal-container.component.ts
import { Component, ComponentRef, ViewChild, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-modal-container',
  templateUrl: './modal-container.component.html',
  styleUrls: ['./modal-container.component.scss'],
  standalone: false
})
export class ModalContainerComponent {
  @ViewChild('modalContent', { read: ViewContainerRef }) modalContent!: ViewContainerRef;
  isOpen = false;

  open(component: any) {
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
}
