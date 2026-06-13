import { Component, inject } from '@angular/core';
import { UnlockService } from 'src/app/services/unlock.service';
import { FEATURES, FeatureDef } from 'src/app/services/unlock-config';

// Ventana de progreso: botones para desbloquear features (personajes, paneles…).
// Lee el registro estático FEATURES y consolida el desbloqueo vía UnlockService.
// De momento cada botón concede directamente (grantById); cuando existan las
// fuentes reales (misiones, logros) se pueden sustituir por las condiciones.
@Component({
  selector: 'app-progress-panel',
  templateUrl: './progress-panel.component.html',
  styleUrls: ['./progress-panel.component.scss'],
  standalone: false,
})
export class ProgressPanelComponent {
  unlocks = inject(UnlockService);

  get charFeatures(): FeatureDef[] {
    return FEATURES.filter(f => f.id.startsWith('char.'));
  }

  get otherFeatures(): FeatureDef[] {
    return FEATURES.filter(f => !f.id.startsWith('char.'));
  }

  label(f: FeatureDef): string {
    return f.name ?? f.id;
  }

  isUnlocked(f: FeatureDef): boolean {
    return this.unlocks.isUnlocked(f.id);
  }

  unlock(f: FeatureDef): void {
    this.unlocks.grantById(f.id);
  }
}
