import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { SKILL_REGISTRY } from './skill-config';

@Injectable({ providedIn: 'root' })
export class SkillActivationService {
  readonly activate$ = new Subject<string>();
  private cooldowns: Record<string, number> = {};

  request(abilityId: string): void {
    const cfg = SKILL_REGISTRY[abilityId];
    if (!cfg) return;
    const now = Date.now();
    if (now - (this.cooldowns[abilityId] ?? 0) < cfg.cooldown) return;
    this.cooldowns[abilityId] = now;
    this.activate$.next(abilityId);
  }

  isOnCooldown(abilityId: string): boolean {
    const cfg = SKILL_REGISTRY[abilityId];
    if (!cfg) return false;
    return Date.now() - (this.cooldowns[abilityId] ?? 0) < cfg.cooldown;
  }

  cooldownRatio(abilityId: string): number {
    const cfg = SKILL_REGISTRY[abilityId];
    if (!cfg) return 0;
    const elapsed = Date.now() - (this.cooldowns[abilityId] ?? 0);
    return Math.max(0, 1 - elapsed / cfg.cooldown);
  }

  resetCooldowns(): void {
    this.cooldowns = {};
  }
}
