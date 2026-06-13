import { Component, inject } from '@angular/core';
import { CityBuildService } from 'src/app/services/city-build.service';

/**
 * Modal de confirmación de borrado de edificio. Siempre montado en el layout;
 * se muestra cuando `pendingDelete$` tiene un edificio (lo pone la escena al
 * pinchar un edificio en modo "Borrar edificio").
 */
@Component({
  selector: 'app-build-delete-modal',
  templateUrl: './build-delete-modal.component.html',
  styleUrls: ['./build-delete-modal.component.scss'],
  standalone: false,
})
export class BuildDeleteModalComponent {
  private cityBuild = inject(CityBuildService);

  readonly pending$ = this.cityBuild.pendingDelete$;

  /** Clave i18n del nombre del edificio pendiente (para el texto del modal). */
  nameKey(type: string): string {
    return this.cityBuild.def(type)?.name ?? type;
  }

  confirm(): void {
    this.cityBuild.confirmDelete();
  }

  cancel(): void {
    this.cityBuild.cancelDelete();
  }
}
