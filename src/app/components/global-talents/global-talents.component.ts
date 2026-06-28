import { Component, inject, OnInit } from '@angular/core';
import { SaveService } from 'src/app/services/save.service';

// Ventana de TALENTOS GLOBALES de la cuenta (panel izquierdo). De momento sin
// contenido: solo muestra arriba el nivel total = suma de los niveles de todos
// los personajes de la cuenta (SaveService.getGlobalLevels()).
@Component({
  selector: 'app-global-talents',
  templateUrl: './global-talents.component.html',
  styleUrls: ['./global-talents.component.scss'],
  standalone: false,
})
export class GlobalTalentsComponent implements OnInit {
  private save = inject(SaveService);

  /** Suma de niveles de todos los personajes; null mientras carga. */
  totalLevel: number | null = null;

  async ngOnInit(): Promise<void> {
    this.totalLevel = await this.save.getGlobalLevels();
  }
}
