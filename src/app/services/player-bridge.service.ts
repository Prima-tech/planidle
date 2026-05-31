import { Injectable } from '@angular/core';
import { IAttack, Player } from '../pnj/player/player';
import { SceneManager } from '../scenes/scene-manager';
import { PlayerStateService } from './player-state.service';

@Injectable({ providedIn: 'root' })
export class PlayerBridgeService {

  player: Player;

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
    this.player.receiveAttack(attack);
    this.playerState.setHp(this.player.status.HP, this.player.status.HPMax);
  }

  resetPlayerStatus(currentHp: number, maxHp: number): void {
    this.player?.resetStatus(currentHp, maxHp);
  }

  restartGameScene(): void {
    const game = this.sceneManager.game;
    if (!game) return;
    const scene = game.scene.getScene('GameScene');
    if (scene?.scene.isActive()) {
      scene.scene.restart();
    } else {
      game.scene.start('GameScene');
    }
  }
}
