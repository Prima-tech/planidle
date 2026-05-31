import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OfflineGains, OfflineGainsService } from 'src/app/services/offline-gains.service';

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

  collect() {
    this.collected.emit(this.gains);
  }
}
