import { Component, inject } from "@angular/core";
import { SceneManager } from "src/app/scenes/scene-manager";
import { AsgardService } from "src/app/services/asgard";
import { InventoryService } from "src/app/services/inventory.service";
import { IAttack } from "src/app/pnj/player/player";
import { SaveService, SaveStatus } from "src/app/services/save.service";
import { map } from "rxjs";

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false
})
export class SettingsPageComponent {
  private sceneManager  = inject(SceneManager);
  private asgardService = inject(AsgardService);
  private inventoryService = inject(InventoryService);
  private saveService   = inject(SaveService);

  readonly saveStatus$ = this.saveService.status$;
  readonly saveLabel$  = this.saveStatus$.pipe(map(s => SAVE_LABELS[s]));
  readonly isSaving$   = this.saveStatus$.pipe(map(s => s === 'local' || s === 'remote'));

  async save() {
    await this.saveService.forceSave();
  }

  changeScene(scene: string) {
    this.asgardService.triggerCloseMenu();
    this.sceneManager.changeScene(scene);
  }

  changePlayer() {
    this.asgardService.changePlayer();
    this.asgardService.triggerCloseMenu();
  }

  debugAttack() {
    const attack: IAttack = { HP: -10 };
    this.asgardService.setAttackToPlayer(attack);
  }

  debugDeath() {
    this.asgardService.player.death();
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
      console.table(slots);
    });
  }
}

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle:   'Guardar partida',
  local:  'Guardando local...',
  remote: 'Sincronizando...',
  saved:  'Guardado',
  error:  'Error al sincronizar',
};
