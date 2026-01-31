import { Component, ComponentRef, inject, Input, ViewChild, ViewContainerRef } from '@angular/core';
import { AsgardService } from 'src/app/services/asgard';
import { Subscription } from 'rxjs'; // Importamos Subscription

@Component({
  selector: 'app-modal-container',
  templateUrl: './modal-container.component.html',
  styleUrls: ['./modal-container.component.scss'],
  standalone: false
})
export class ModalContainerComponent {
  @ViewChild('modalContent', { read: ViewContainerRef }) modalContent!: ViewContainerRef;
  private asgardService = inject(AsgardService);

  private closeSub?: Subscription; // Variable para guardar la suscripción

  isOpen = false;
  type: string;

  open(component: any, type: string) {
    this.type = type;
    this.isOpen = true;

    setTimeout(() => {
      this.modalContent.clear();
      this.modalContent.createComponent(component);
    });

    // Guardamos la suscripción
    this.closeSub = this.asgardService.closeMenu$.subscribe(() => {
      this.close();
    });
  }

  close() {
    // 1. Limpiamos la suscripción para que no se quede colgada
    if (this.closeSub) {
      this.closeSub.unsubscribe();
    }

    // 2. Limpiamos el contenido y cerramos
    this.modalContent.clear();
    this.isOpen = false;
  }

  isOpenModal() {
    return this.isOpen;
  }
}