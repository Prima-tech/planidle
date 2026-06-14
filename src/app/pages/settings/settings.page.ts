import { Component, inject, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { map } from "rxjs";
import { SceneManager } from "src/app/scenes/scene-manager";
import { AsgardService } from "src/app/services/asgard";
import { PlayerBridgeService } from "src/app/services/player-bridge.service";
import { InventoryService } from "src/app/services/inventory.service";
import { IAttack } from "src/app/pnj/player/player";
import { SaveService, SaveStatus, LocalInfo, ChangeDelta } from "src/app/services/save.service";
import { CityBuildService } from "src/app/services/city-build.service";
import { BuildShopService } from "src/app/services/build-shop.service";
import { ConnectionService } from "src/app/services/connection.service";

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false
})
export class SettingsPageComponent implements OnInit {
  private sceneManager     = inject(SceneManager);
  private asgardService    = inject(AsgardService);
  private playerBridge     = inject(PlayerBridgeService);
  private inventoryService = inject(InventoryService);
  private saveService      = inject(SaveService);
  private cityBuild        = inject(CityBuildService);
  private buildShop        = inject(BuildShopService);
  private connection       = inject(ConnectionService);
  private router           = inject(Router);

  /** Estado de conexión mostrado en la cabecera del panel. */
  connected = false;

  async ngOnInit() {
    this.connected = await this.connection.isConnected();
  }

  /** Cierra sesión de Supabase, vuelve a modo local y regresa al login. */
  async logout() {
    await this.connection.logout();
    this.connected = false;
    this.asgardService.triggerCloseMenu();
    this.router.navigate(['/login']);
  }

  readonly saveStatus$ = this.saveService.status$;
  readonly saveLabel$  = this.saveStatus$.pipe(map(s => SAVE_LABELS[s]));
  readonly isSaving$   = this.saveStatus$.pipe(map(s => s === 'local' || s === 'remote'));

  localInfo: LocalInfo | null = null;
  delta: ChangeDelta | null = null;
  loadingInfo    = false;
  loadingDelta   = false;

  readonly FIELD_LABELS: Record<string, string> = {
    coins:        'SETTINGS.INFO.COINS',
    specialCoins: 'SETTINGS.INFO.SPECIAL_COINS',
    exp:          'SETTINGS.INFO.EXP',
    lvl:          'SETTINGS.INFO.LVL',
  };

  async save() {
    await this.saveService.forceSave();
  }

  async clearAll() {
    await this.saveService.clearCurrentCharacter();
    // Las construcciones de ciudad viven en una clave global compartida, fuera
    // del snapshot por personaje: hay que borrarlas aparte para poder reconstruir.
    await this.cityBuild.clear();
    // La tienda guarda su oro/stock aparte (clave global): restablecer a 500.
    await this.buildShop.reset();
    // La barra de HP lee el sprite Phaser, no el playerState: sin esto el
    // reset no se refleja en la barra hasta revivir o recargar
    this.playerBridge.resetPlayerStatus(100, 100);
    // Refresca los paneles abiertos si los hay
    if (this.localInfo) this.localInfo = await this.saveService.getLocalInfo();
    if (this.delta)     this.delta     = await this.saveService.getDelta();
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

  async changePlayer() {
    await this.asgardService.changePlayer();
    this.asgardService.triggerCloseMenu();
  }

  debugAttack() {
    const attack: IAttack = { HP: -10 };
    this.playerBridge.setAttackToPlayer(attack);
  }

  debugDeath() {
    this.playerBridge.player.death();
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
  idle:   'SETTINGS.BTN.SAVE_IDLE',
  local:  'SETTINGS.BTN.SAVE_LOCAL',
  remote: 'SETTINGS.BTN.SAVE_REMOTE',
  saved:  'SETTINGS.BTN.SAVE_SAVED',
  error:  'SETTINGS.BTN.SAVE_ERROR',
};
