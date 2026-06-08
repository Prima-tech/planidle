import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AutoAttackService {
  isEnabled = false;

  toggle(): void {
    this.isEnabled = !this.isEnabled;
  }
}
