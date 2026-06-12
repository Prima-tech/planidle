import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AutoAttackService {
  isEnabled = false;
  /** Lanza automáticamente las skills equipadas cuando están listas (toggle propio) */
  skillsEnabled = false;

  toggle(): void {
    this.isEnabled = !this.isEnabled;
  }

  toggleSkills(): void {
    this.skillsEnabled = !this.skillsEnabled;
  }

  // ── Pausa por input manual ──────────────────────────────────────────────────
  // Tocar ataque, moverse o lanzar una skill a mano pausa la automatización;
  // se renueva mientras dure el input y se reanuda sola al expirar.

  private pausedUntil = 0;

  pauseAutomation(ms = 3000): void {
    const until = Date.now() + ms;
    if (until > this.pausedUntil) this.pausedUntil = until;
  }

  get isPausedByManual(): boolean {
    return Date.now() < this.pausedUntil;
  }
}
