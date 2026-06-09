import { Component, inject, Input, ViewChild, ViewContainerRef } from '@angular/core';
import { AsgardService } from 'src/app/services/asgard';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-modal-container',
  templateUrl: './modal-container.component.html',
  styleUrls: ['./modal-container.component.scss'],
  standalone: false
})
export class ModalContainerComponent {
  @ViewChild('modalContent', { read: ViewContainerRef }) modalContent!: ViewContainerRef;
  private asgardService = inject(AsgardService);

  /** Si true, el modal no se cierra al tocar el canvas del juego (closeMenu$). */
  @Input() persistent = false;

  private closeSub?: Subscription;

  isOpen = false;
  type: string;

  open(component: any, type: string) {
    this.type = type;
    this.isOpen = true;

    setTimeout(() => {
      this.modalContent.clear();
      this.modalContent.createComponent(component);
    });

    if (!this.persistent) {
      this.closeSub = this.asgardService.closeMenu$.subscribe(() => this.close());
    }
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