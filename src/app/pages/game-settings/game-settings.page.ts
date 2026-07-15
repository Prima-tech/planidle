import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { GameSettingsService, AppLanguage } from 'src/app/services/game-settings.service';
import { AudioService } from 'src/app/services/audio.service';
import { ConnectionService } from 'src/app/services/connection.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { SaveService, SaveStatus } from 'src/app/services/save.service';
import { AsgardService } from 'src/app/services/asgard';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { PARALLAX_THEME_LIST } from 'src/app/scenes/gamescene/parallax-themes';
import { WORLD_PARALLAX_SETS } from 'src/app/scenes/worldrun/parallax-sets';
import { APP_VERSION } from 'src/app/version';

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle:     'SETTINGS.BTN.SAVE_IDLE',
  local:    'SETTINGS.BTN.SAVE_LOCAL',
  remote:   'SETTINGS.BTN.SAVE_REMOTE',
  saved:    'SETTINGS.BTN.SAVE_SAVED',
  error:    'SETTINGS.BTN.SAVE_ERROR',
  conflict: 'SETTINGS.BTN.SAVE_ERROR',
};

@Component({
  selector: 'app-game-settings-page',
  templateUrl: './game-settings.page.html',
  styleUrls: ['./game-settings.page.scss'],
  standalone: false
})
export class GameSettingsPageComponent implements OnInit, OnDestroy {
  tab: 0 | 1 | 2 = 0;
  gs = inject(GameSettingsService);
  audio = inject(AudioService);
  private connection = inject(ConnectionService);
  private supabase = inject(SupabaseService);
  private saveService = inject(SaveService);
  private asgard = inject(AsgardService);
  private playerState = inject(PlayerStateService);
  private playerBridge = inject(PlayerBridgeService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  /** Admin: cantidad de monedas a regalar (1..1.000.000) seleccionada en la barra. */
  adminCoins = 1000;
  readonly ADMIN_COINS_MAX = 1_000_000;
  readonly appVersion = APP_VERSION;
  readonly parallaxThemes = PARALLAX_THEME_LIST;
  readonly worldParallaxSets = WORLD_PARALLAX_SETS;

  /** ¿Conectado a Supabase? (modo Supabase + sesión activa). Se calcula al abrir. */
  supabaseConnected = false;

  /** ¿La sesión actual es de un INVITADO (anónimo)? Muestra el bloque "Vincular correo". */
  isGuest = false;
  /** Identidad para la pastilla: email (cuenta) o UID (invitado). null = sin sesión. */
  identity: { isAnonymous: boolean; email: string | null; id: string } | null = null;
  /** Formulario de vinculación de correo (invitado → cuenta permanente). Vive en un modal. */
  linkModalOpen = false;
  linkEmail = '';
  linkPassword = '';
  linkError = '';
  linkOk = false;
  linkLoading = false;

  // Guardado de la partida (botón movido aquí desde la pantalla admin).
  readonly saveStatus$ = this.saveService.status$;
  readonly saveLabel$  = this.saveStatus$.pipe(map(s => SAVE_LABELS[s]));
  readonly isSaving$   = this.saveStatus$.pipe(map(s => s === 'local' || s === 'remote'));

  async ngOnInit(): Promise<void> {
    this.supabaseConnected = await this.connection.isConnected();
    if (this.supabaseConnected) {
      this.identity = await this.supabase.getIdentity();
      // Solo tiene sentido vincular correo si la sesión es de invitado (anónima).
      this.isGuest = !!this.identity?.isAnonymous;
    }
  }

  /** Abre el modal del formulario de vinculación (parte de un formulario LIMPIO).
   *  Apaga el teclado de Phaser para poder escribir en los inputs sin mover al PJ. */
  openLinkModal(): void {
    this.linkEmail = '';
    this.linkPassword = '';
    this.linkError = '';
    this.linkModalOpen = true;
    this.playerBridge.setGameKeyboardEnabled(false);
  }

  /** Cierra el modal de vinculación sin vincular y reactiva el teclado del juego. */
  closeLinkModal(): void {
    if (this.linkLoading) return;
    this.linkModalOpen = false;
    this.playerBridge.setGameKeyboardEnabled(true);
  }

  ngOnDestroy(): void {
    // Red de seguridad: si el panel se cierra con el modal abierto, no dejar el
    // teclado del juego apagado.
    this.playerBridge.setGameKeyboardEnabled(true);
  }

  /** Vincula email + contraseña a la cuenta invitada actual → cuenta permanente.
   *  Mantiene el mismo user.id, así que no se pierde ningún progreso. */
  async linkAccount(): Promise<void> {
    if (this.linkLoading) return;
    this.linkError = '';
    this.linkOk = false;

    const email = this.linkEmail.trim();
    const password = this.linkPassword;
    if (!email || !password) {
      this.linkError = this.translate.instant('SETTINGS.LINK.ERR.CREDENTIALS');
      return;
    }
    if (password.length < 6) {
      this.linkError = this.translate.instant('SETTINGS.LINK.ERR.SHORT_PASSWORD');
      return;
    }

    this.linkLoading = true;
    try {
      const { error } = await this.supabase.linkEmail(email, password);
      if (error) {
        // Colisión típica: el correo ya pertenece a otra cuenta → no se pueden fusionar.
        this.linkError = /already|registered|exists/i.test(error.message)
          ? this.translate.instant('SETTINGS.LINK.ERR.EMAIL_TAKEN')
          : error.message;
        return;
      }
      // Éxito: ya no es invitado. Cerramos el modal, refrescamos la pastilla y confirmamos.
      this.isGuest = false;
      this.linkModalOpen = false;
      this.playerBridge.setGameKeyboardEnabled(true);
      this.identity = await this.supabase.getIdentity();
      this.linkOk = true;
      this.linkEmail = '';
      this.linkPassword = '';
    } catch (e: any) {
      this.linkError = e?.message ?? this.translate.instant('SETTINGS.LINK.ERR.CONNECTION');
    } finally {
      this.linkLoading = false;
    }
  }

  // ── Idioma: persiste el ajuste y lo aplica EN CALIENTE (translate.use) ─────────
  get language(): AppLanguage { return this.gs.language; }
  setLanguage(lang: AppLanguage): void {
    if (this.gs.language === lang) return;
    this.gs.setLanguage(lang);
    this.translate.use(lang);   // recarga todos los pipes `| translate` al vuelo
  }

  // ── Audio: volúmenes en % para los sliders (el servicio guarda 0..1) ──────────
  get masterPct(): number { return Math.round(this.audio.masterVolume * 100); }
  set masterPct(v: number) { this.audio.setMasterVolume(v / 100); }

  get sfxPct(): number { return Math.round(this.audio.sfxVolume * 100); }
  set sfxPct(v: number) { this.audio.setSfxVolume(v / 100); }

  get musicPct(): number { return Math.round(this.audio.musicVolume * 100); }
  set musicPct(v: number) { this.audio.setMusicVolume(v / 100); }

  /** Suena un click al soltar el slider de SFX para oír el nivel elegido. */
  previewSfx(): void { this.audio.unlock(); this.audio.play('ui_click'); }

  async save(): Promise<void> {
    this.saveService.conflict$.next(null);
    await this.saveService.forceSave();

    // Conflicto: la nube tiene una partida más nueva (otro dispositivo). Preguntamos
    // antes de sobrescribirla; solo si el usuario acepta forzamos la subida.
    const conflict = this.saveService.conflict$.value;
    if (conflict) {
      this.saveService.conflict$.next(null);
      const when = new Date(conflict.remoteLastModified).toLocaleString();
      const ok = confirm(this.translate.instant('SETTINGS.CONFIRM.OVERWRITE_CLOUD', { when }));
      if (ok) await this.saveService.forceSave(true);
    }
  }

  /** Admin: suma al personaje activo la cantidad de monedas de la barra. */
  grantCoins(): void {
    const amount = Math.max(1, Math.min(this.ADMIN_COINS_MAX, Math.floor(this.adminCoins) || 0));
    this.playerState.collectCoins(amount);
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

  /** Borra los datos de la cuenta de Supabase conectada (nube + local) y vuelve al login. */
  async clearRemoteAccount(): Promise<void> {
    if (!confirm(this.translate.instant('SETTINGS.CONFIRM.DELETE_ACCOUNT'))) return;
    try {
      await this.saveService.wipeRemoteAccountData();
    } catch (e) {
      console.error('[Settings] No se pudo borrar la cuenta de Supabase', e);
      alert(this.translate.instant('SETTINGS.CONFIRM.DELETE_ACCOUNT_ERROR'));
      return;
    }
    this.supabaseConnected = false;
    this.asgard.triggerCloseMenu();
    await this.router.navigateByUrl('/login');
    window.location.reload();
  }
}
