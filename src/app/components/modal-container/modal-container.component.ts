import { Component, EventEmitter, inject, Input, NgZone, Output, ViewChild, ViewContainerRef } from '@angular/core';
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
  private zone = inject(NgZone);

  /** Si true, el modal no se cierra al tocar el canvas del juego (closeMenu$). */
  @Input() persistent = false;
  @Output() closed = new EventEmitter<void>();

  private closeSub?: Subscription;

  isOpen = false;
  type: string;

  open(component: any, type: string) {
    // ngZone.run: este open suele llamarse desde eventos de Phaser (espacio, tocar un
    // edificio/cofre) que corren FUERA de la zona de Angular. Sin esto, la detección de
    // cambios no se dispara, el *ngIf del host (#modalContent) no renderiza y el
    // setTimeout de abajo encuentra `modalContent` undefined → el modal sale vacío / no
    // se abre. Dentro de la zona, el render del host ocurre antes que el setTimeout.
    this.zone.run(() => {
      this.type = type;
      this.isOpen = true;

      setTimeout(() => {
        if (!this.modalContent) return;
        this.modalContent.clear();
        this.modalContent.createComponent(component);
      });

      if (!this.persistent) {
        this.closeSub = this.asgardService.closeMenu$.subscribe(() => this.close());
      }
    });
  }

  close() {
    this.zone.run(() => {
      // 1. Limpiamos la suscripción para que no se quede colgada
      if (this.closeSub) {
        this.closeSub.unsubscribe();
      }

      // 2. Limpiamos el contenido y cerramos. Guard: si se cierra antes de que el
      //    contenido haya renderizado (abrir+cerrar en el mismo frame), modalContent
      //    aún es undefined; sin el guard petaba aquí y, al hacerlo ANTES de isOpen=false,
      //    se repetía cada frame rompiendo toda la UI.
      this.modalContent?.clear();
      this.isOpen = false;
      this.closed.emit();
    });
  }

  isOpenModal() {
    return this.isOpen;
  }
}