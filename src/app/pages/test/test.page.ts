import { Component, inject } from "@angular/core";
import { ModalController } from "@ionic/angular";
import { IAttack } from "src/app/pnj/player/player";
import { SceneManager } from "src/app/scenes/scene-manager";
import { AsgardService } from "src/app/services/asgard";

@Component({
  selector: 'test-page',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
  standalone: false
})

export class testPageComponent {
  private sceneManager = inject(SceneManager);
  private asgardService = inject(AsgardService);
  private modalCtrl = inject(ModalController);

  changeScene(scene: string) {
    this.sceneManager.changeScene(scene);
  }

  test() {
    let attack: IAttack = {
      HP: -10
    }
    this.asgardService.setAttackToPlayer(attack)
  }

  setPlayerDeath() {
    this.asgardService.player.death();
  }

  async changePlayer() {
    this.asgardService.changePlayer();
    this.asgardService.triggerCloseMenu();
  }

}