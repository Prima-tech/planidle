import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OfflineGains, OfflineGainsService, AfkItemGain } from 'src/app/services/offline-gains.service';
import { sheetPos, sheetBgSize } from 'src/app/utils/item-icon.util';

@Component({
  selector: 'app-offline-gains-modal',
  templateUrl: './offline-gains-modal.component.html',
  styleUrls: ['./offline-gains-modal.component.scss'],
  standalone: false,
})
export class OfflineGainsModalComponent {
  @Input()  gains!: OfflineGains;
  @Output() collected = new EventEmitter<OfflineGains>();

  constructor(private offlineGainsService: OfflineGainsService) {}

  get elapsedText(): string {
    return this.offlineGainsService.formatElapsed(this.gains.elapsedMs);
  }

  /** Clave i18n de la actividad que estaba haciendo el personaje (cabecera del modal). */
  get activityLabelKey(): string {
    if (this.gains.kind === 'exploring') return 'ACTIVITY.EXPLORING';
    if (this.gains.kind === 'gathering') {
      return this.gains.gatherSkill === 'woodcutting' ? 'ACTIVITY.CHOPPING' : 'ACTIVITY.MINING';
    }
    return 'ACTIVITY.KILLING';
  }

  // Iconos del botín: recorte de spritesheet (iconSheet) o PNG suelto.
  dropSheetPos(d: AfkItemGain) { return sheetPos(d.entry.iconFrame, d.entry.iconFrameCols, d.entry.iconFrameSize, d.entry.iconContentSize); }
  dropSheetBg(d: AfkItemGain)  { return sheetBgSize(d.entry.iconFrameCols, d.entry.iconFrameSize, d.entry.iconContentSize); }

  collect() {
    this.collected.emit(this.gains);
  }
}
