import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-death-modal',
  templateUrl: './death-modal.component.html',
  styleUrls: ['./death-modal.component.scss'],
  standalone: false,
})
export class DeathModalComponent {
  @Output() revived = new EventEmitter<void>();

  revive(): void {
    this.revived.emit();
  }
}
