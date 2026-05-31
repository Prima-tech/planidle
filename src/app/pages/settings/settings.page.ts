import { Component, inject } from "@angular/core";
import { map } from "rxjs";
import { SceneManager } from "src/app/scenes/scene-manager";
import { AsgardService } from "src/app/services/asgard";
import { InventoryService } from "src/app/services/inventory.service";
import { IAttack } from "src/app/pnj/player/player";
import { SaveService, SaveStatus, LocalInfo, ChangeDelta, SupabasePayload } from "src/app/services/save.service";

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false
})
export class SettingsPageComponent {
  private sceneManager     = inject(SceneManager);
  private asgardService    = inject(AsgardService);
  private inventoryService = inject(InventoryService);
  private saveService      = inject(SaveService);

  readonly saveStatus$ = this.saveService.status$;
  readonly saveLabel$  = this.saveStatus$.pipe(map(s => SAVE_LABELS[s]));
  readonly isSaving$   = this.saveStatus$.pipe(map(s => s === 'local' || s === 'remote'));

  localInfo: LocalInfo | null = null;
  delta: ChangeDelta | null = null;
  payload: SupabasePayload | null = null;
  loadingInfo    = false;
  loadingDelta   = false;
  loadingPayload = false;

  readonly FIELD_LABELS: Record<string, string> = {
    coins:        'Monedas',
    specialCoins: 'Monedas esp.',
    exp:          'EXP',
    lvl:          'Nivel',
  };

  async save() {
    await this.saveService.forceSave();
  }

  async toggleLocalInfo() {
    if (this.localInfo) { this.localInfo = null; return; }
    this.loadingInfo = true;
    this.localInfo = await this.saveService.getLocalInfo();
    this.loadingInfo = false;
  }

  async toggleDelta() {
    if (this.delta) { this.delta = null; return; }
    this.loadingDelta = true;
    this.delta = await this.saveService.getDelta();
    this.loadingDelta = false;
  }

  async togglePayload() {
    if (this.payload) { this.payload = null; return; }
    this.loadingPayload = true;
    this.payload = await this.saveService.getSupabasePayload();
    this.loadingPayload = false;
  }

  payloadFields(fields: Record<string, any>): { key: string; val: string }[] {
    return Object.entries(fields).map(([key, val]) => ({
      key,
      val: typeof val === 'object' ? JSON.stringify(val) : String(val),
    }));
  }

  deltaKeys(delta: ChangeDelta): (keyof ChangeDelta['playerState'])[] {
    return Object.keys(delta.playerState) as any[];
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
