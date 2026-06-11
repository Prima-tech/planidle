import { Injectable } from '@angular/core';
import { distinctUntilChanged, map, Subject } from 'rxjs';
import { IAttack, Player } from '../pnj/player/player';
import { SceneManager } from '../scenes/scene-manager';
import { CharacterStatsService } from './character-stats.service';
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
    charStats: CharacterStatsService,
  ) {
    // El sprite Phaser es la fuente de verdad de la barra de HP, pero hasta ahora
    // su HPMax solo se fijaba al seleccionar personaje o revivir. Aquí lo mantenemos
    // en sync cuando cambia el HP máximo (CONST, equipo +hp, talentos).
    charStats.hp$
      .pipe(map(b => b.total), distinctUntilChanged())
      .subscribe(total => {
        if (!this.player) return;
        const newHP = Math.min(this.player.status.HP, total);
        this.player.resetStatus(newHP, total);
        this.playerState.setHp(newHP, total);
      });
  }

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
