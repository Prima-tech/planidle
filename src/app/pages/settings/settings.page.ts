import { Component, inject, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { map } from "rxjs";
import { SceneManager } from "src/app/scenes/scene-manager";
import { AsgardService } from "src/app/services/asgard";
import { SaveService, SaveStatus } from "src/app/services/save.service";
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
  private saveService      = inject(SaveService);
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

  async save() {
    await this.saveService.forceSave();
  }

  async clearAll() {
    // Wipe TOTAL de la cuenta: borra todos los personajes y datos globales.
    await this.saveService.wipeAllData();
    this.asgardService.triggerCloseMenu();
    // Recarga dura en el login: garantiza que TODOS los servicios singleton
    // (asgard, unlocks, kills, talentos, ciudad…) arrancan limpios desde el
    // storage ya vacío, sin estado en memoria obsoleto.
    await this.router.navigateByUrl('/login');
    window.location.reload();
  }

  changeScene(scene: string) {
    this.asgardService.triggerCloseMenu();
    this.sceneManager.changeScene(scene);
  }

  async changePlayer() {
    await this.asgardService.changePlayer();
    this.asgardService.triggerCloseMenu();
  }
}

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle:   'SETTINGS.BTN.SAVE_IDLE',
  local:  'SETTINGS.BTN.SAVE_LOCAL',
  remote: 'SETTINGS.BTN.SAVE_REMOTE',
  saved:  'SETTINGS.BTN.SAVE_SAVED',
  error:  'SETTINGS.BTN.SAVE_ERROR',
};
