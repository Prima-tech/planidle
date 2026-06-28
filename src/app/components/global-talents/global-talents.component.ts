import { Component, inject, OnInit } from '@angular/core';
import { SaveService } from 'src/app/services/save.service';
import { AccountUpgradesService, ACCOUNT_UPGRADES } from 'src/app/services/account-upgrades.service';

// Ventana de TALENTOS / MEJORAS GLOBALES de la cuenta (panel izquierdo). Muestra el
// nivel total (suma de los niveles de todos los personajes) y las mejoras de cuenta,
// que se asignan con un total de puntos (AccountUpgradesService).
@Component({
  selector: 'app-global-talents',
  templateUrl: './global-talents.component.html',
  styleUrls: ['./global-talents.component.scss'],
  standalone: false,
})
export class GlobalTalentsComponent implements OnInit {
  private save = inject(SaveService);
  private upgradesSvc = inject(AccountUpgradesService);

  /** Suma de niveles de todos los personajes; null mientras carga. */
  totalLevel: number | null = null;

  readonly upgrades = ACCOUNT_UPGRADES;
  readonly total = AccountUpgradesService.TOTAL_POINTS;
  readonly available$ = this.upgradesSvc.availablePoints$;

  async ngOnInit(): Promise<void> {
    this.totalLevel = await this.save.getGlobalLevels();
  }

  isActive(id: string): boolean { return this.upgradesSvc.isActive(id); }
  toggle(id: string): void { this.upgradesSvc.toggle(id); }
}
