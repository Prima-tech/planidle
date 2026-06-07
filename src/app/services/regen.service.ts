import { Injectable } from '@angular/core';
import { Subject, Subscription, interval } from 'rxjs';
import { CharacterStatsService } from './character-stats.service';
import { PlayerStateService } from './player-state.service';
import { PlayerBridgeService } from './player-bridge.service';

export interface RegenTick {
  hp: number;
  mp: number;
}

const REGEN_INTERVAL_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class RegenService {
  readonly regenTick$ = new Subject<RegenTick>();
  private timerSub: Subscription | null = null;

  constructor(
    private playerState: PlayerStateService,
    private charStats: CharacterStatsService,
    private playerBridge: PlayerBridgeService,
  ) {}

  start(): void {
    this.stop();
    this.timerSub = interval(REGEN_INTERVAL_MS).subscribe(() => this.tick());
  }

  stop(): void {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
  }

  private tick(): void {
    const state   = this.playerState.snapshot();
    const hpRegen = this.charStats.currentHpRegen;
    const mpRegen = this.charStats.currentMpRegen;

    let gainedHp = 0;
    let gainedMp = 0;

    // HP: read live from Phaser sprite so the bar source of truth stays in sync
    const phaserHP    = this.playerBridge.player?.status?.HP ?? state.hp;
    const phaserHPMax = this.playerBridge.player?.status?.HPMax ?? state.hpMax;

    if (hpRegen.total > 0 && phaserHP < phaserHPMax) {
      const roll = Math.floor(Math.random() * (hpRegen.total - hpRegen.min + 1)) + hpRegen.min;
      gainedHp   = Math.min(roll, phaserHPMax - phaserHP);
      this.playerBridge.healPlayer(gainedHp);  // updates Phaser sprite + playerState
    }

    if (mpRegen.total > 0 && state.mp < state.mpMax) {
      const roll = Math.floor(Math.random() * (mpRegen.total - mpRegen.min + 1)) + mpRegen.min;
      gainedMp   = Math.min(roll, state.mpMax - state.mp);
      this.playerState.setMp(state.mp + gainedMp, state.mpMax);
    }

    if (gainedHp > 0 || gainedMp > 0) {
      this.regenTick$.next({ hp: gainedHp, mp: gainedMp });
    }
  }
}
