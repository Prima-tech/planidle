import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PanelStateService {
  private states: Record<string, any> = {};

  get<T>(key: string, fallback: T): T {
    return key in this.states ? (this.states[key] as T) : fallback;
  }

  set(key: string, value: any): void {
    this.states[key] = value;
  }

  reset(): void {
    this.states = {};
  }
}
