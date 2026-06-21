import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { GameSettingsService } from 'src/app/services/game-settings.service';
import { ConnectionService } from 'src/app/services/connection.service';
import { SaveService, SaveStatus } from 'src/app/services/save.service';
import { AsgardService } from 'src/app/services/asgard';
import { PARALLAX_THEME_LIST } from 'src/app/scenes/gamescene/parallax-themes';
import { WORLD_PARALLAX_SETS } from 'src/app/scenes/worldrun/parallax-sets';
import { APP_VERSION } from 'src/app/version';

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle:   'SETTINGS.BTN.SAVE_IDLE',
  local:  'SETTINGS.BTN.SAVE_LOCAL',
  remote: 'SETTINGS.BTN.SAVE_REMOTE',
  saved:  'SETTINGS.BTN.SAVE_SAVED',
  error:  'SETTINGS.BTN.SAVE_ERROR',
};

@Component({
  selector: 'app-game-settings-page',
  templateUrl: './game-settings.page.html',
  styleUrls: ['./game-settings.page.scss'],
  standalone: false
})
export class GameSettingsPageComponent implements OnInit {
  tab: 0 | 1 | 2 = 0;
  gs = inject(GameSettingsService);
  private connection = inject(ConnectionService);
  private saveService = inject(SaveService);
  private asgard = inject(AsgardService);
  private router = inject(Router);
  readonly appVersion = APP_VERSION;
  readonly parallaxThemes = PARALLAX_THEME_LIST;
  readonly worldParallaxSets = WORLD_PARALLAX_SETS;

  /** ¿Conectado a Supabase? (modo Supabase + sesión activa). Se calcula al abrir. */
  supabaseConnected = false;

  // Guardado de la partida (botón movido aquí desde la pantalla admin).
  readonly saveStatus$ = this.saveService.status$;
  readonly saveLabel$  = this.saveStatus$.pipe(map(s => SAVE_LABELS[s]));
  readonly isSaving$   = this.saveStatus$.pipe(map(s => s === 'local' || s === 'remote'));

  async ngOnInit(): Promise<void> {
    this.supabaseConnected = await this.connection.isConnected();
  }

  async save(): Promise<void> {
    await this.saveService.forceSave();
  }

  /** Cierra sesión de Supabase, vuelve a modo local y regresa al login. */
  async logout(): Promise<void> {
    await this.connection.logout();
    this.supabaseConnected = false;
    this.asgard.triggerCloseMenu();
    this.router.navigate(['/login']);
  }

  /** Wipe TOTAL de la cuenta (todos los personajes y datos globales) + recarga limpia. */
  async clearAll(): Promise<void> {
    await this.saveService.wipeAllData();
    this.asgard.triggerCloseMenu();
    await this.router.navigateByUrl('/login');
    window.location.reload();
  }
}
