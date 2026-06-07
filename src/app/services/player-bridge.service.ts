import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { IAttack, Player } from '../pnj/player/player';
import { SceneManager } from '../scenes/scene-manager';
import { PlayerStateService } from './player-state.service';

@Injectable({ providedIn: 'root' })
export class PlayerBridgeService {

  player: Player;
  isDead = false;
  readonly death$ = new Subject<void>();
  readonly sceneStarting$ = new Subject<void>();
  readonly sceneReady$ = new Subject<void>();

  constructor(
    private sceneManager: SceneManager,
    private playerState: PlayerStateService,
  ) {}

  createPlayer(): void {
    this.player = new Player();
  }

  getPlayer(): Player {
    return this.player;
  }

  setInitialSprites(sprites: any): void {
    this.player.setInitialSprites(sprites);
  }

  setAttackToPlayer(attack: IAttack): void {
    if (this.isDead) return;
    this.player.receiveAttack(attack);
    const { HP, HPMax } = this.player.status;
    this.playerState.setHp(HP, HPMax);
    if (HP <= 0) {
      this.isDead = true;
      this.player.death();
      this.playerState.recordDeath();
      this.death$.next();
    }
  }

  healPlayer(amount: number): void {
    if (!this.player || amount <= 0) return;
    const { HP, HPMax } = this.player.status;
    const newHP = Math.min(HP + amount, HPMax);
    this.player.resetStatus(newHP, HPMax);
    this.playerState.setHp(newHP, HPMax);
  }

  resetPlayerStatus(currentHp: number, maxHp: number): void {
    this.player?.resetStatus(currentHp, maxHp);
  }

  restartGameScene(): void {
    const game = this.sceneManager.game;
    if (!game) return;
    this.sceneStarting$.next();
    const scene = game.scene.getScene('GameScene');
    if (scene?.scene.isActive()) {
      scene.scene.restart();
    } else {
      game.scene.start('GameScene');
    }
  }

  emitSceneReady(): void {
    this.sceneReady$.next();
  }
}
