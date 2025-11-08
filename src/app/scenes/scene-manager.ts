import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class SceneManager {
  game: Phaser.Game;

  constructor(
   ) {}

  setGame(game: Phaser.Game) {
    this.game = game;
  }

  changeScene(targetScene: string) {
    const activeScenes = this.game.scene.getScenes(true);
    activeScenes.forEach(scene => {
      this.game.scene.stop(scene.scene.key);
    });
    this.game.scene.start(targetScene);
  }

}
