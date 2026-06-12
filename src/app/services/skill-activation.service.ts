import { inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { SKILL_REGISTRY } from './skill-config';
import { AutoAttackService } from './auto-attack.service';

@Injectable({ providedIn: 'root' })
export class SkillActivationService {
  readonly activate$ = new Subject<{ abilityId: string; damage: number }>();
  private cooldowns: Record<string, number> = {};
  private autoAttack = inject(AutoAttackService);

  /** `auto = true` cuando lanza el auto-cast: no pausa la automatización */
  request(abilityId: string, damage: number, auto = false): void {
    const cfg = SKILL_REGISTRY[abilityId];
    if (!cfg) return;
    if (!auto) this.autoAttack.pauseAutomation();
    const now = Date.now();
    if (now - (this.cooldowns[abilityId] ?? 0) < cfg.cooldown) return;
    this.cooldowns[abilityId] = now;
    this.activate$.next({ abilityId, damage });
  }

  isOnCooldown(abilityId: string): boolean {
    const cfg = SKILL_REGISTRY[abilityId];
    if (!cfg) return false;
    return Date.now() - (this.cooldowns[abilityId] ?? 0) < cfg.cooldown;
  }

  /** 0 = listo, 1 = recién activado (cooldown completo) */
  cooldownRatio(abilityId: string): number {
    const cfg = SKILL_REGISTRY[abilityId];
    if (!cfg) return 0;
    const elapsed = Date.now() - (this.cooldowns[abilityId] ?? 0);
    return Math.max(0, 1 - elapsed / cfg.cooldown);
  }

  /** Segundos restantes de cooldown */
  cooldownRemaining(abilityId: string): number {
    const cfg = SKILL_REGISTRY[abilityId];
    if (!cfg) return 0;
    const elapsed = Date.now() - (this.cooldowns[abilityId] ?? 0);
    return Math.max(0, (cfg.cooldown - elapsed) / 1000);
  }

  resetCooldowns(): void {
    this.cooldowns = {};
  }

  refundCooldown(abilityId: string): void {
    delete this.cooldowns[abilityId];
  }

  private targetAvailable: Record<string, boolean> = {};

  setTargetAvailable(abilityId: string, available: boolean): void {
    this.targetAvailable[abilityId] = available;
  }

  hasTarget(abilityId: string): boolean {
    return this.targetAvailable[abilityId] ?? false;
  }
}
