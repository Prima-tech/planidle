import { Component, inject } from "@angular/core";
import { ModalController } from "@ionic/angular";
import { IAttack } from "src/app/pnj/player/player";
import { SceneManager } from "src/app/scenes/scene-manager";
import { AsgardService } from "src/app/services/asgard";
import { InventoryService } from "src/app/services/inventory.service";

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
  private inventoryService = inject(InventoryService);

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

  printInventory() {
    this.inventoryService.load().then(grid => {
      const slots: any[] = [];
      grid.forEach((tab, t) =>
        tab.forEach((row, r) =>
          row.forEach((item, c) => {
            if (item) slots.push({ tab: t, row: r, col: c, ...item });
          })
        )
      );
      console.log('=== INVENTORY PAYLOAD ===');
      console.table(slots);
      console.log(JSON.stringify(slots, null, 2));
    });
  }

}