import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { GameSettingsService, AppLanguage } from 'src/app/services/game-settings.service';
import { AudioService } from 'src/app/services/audio.service';
import { ConnectionService } from 'src/app/services/connection.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { SaveService } from 'src/app/services/save.service';
import { AsgardService } from 'src/app/services/asgard';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { APP_VERSION } from 'src/app/version';

@Component({
  selector: 'app-game-settings-page',
  templateUrl: './game-settings.page.html',
  styleUrls: ['./game-settings.page.scss'],
  standalone: false
})
export class GameSettingsPageComponent implements OnInit, OnDestroy {
  /** Pestaña única: 0 = Juego. Admin y Estilos viven en la ventana de admin (minimapa). */
  tab: 0 = 0;
  gs = inject(GameSettingsService);
  audio = inject(AudioService);
  private connection = inject(ConnectionService);
  private supabase = inject(SupabaseService);
  private saveService = inject(SaveService);
  private asgard = inject(AsgardService);
  private playerBridge = inject(PlayerBridgeService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  readonly appVersion = APP_VERSION;

  /** ¿Conectado a Supabase? (modo Supabase + sesión activa). Se calcula al abrir. */
  supabaseConnected = false;

  /** Mensaje breve bajo el botón Guardar tras pulsarlo (clave i18n o ''). */
  saveMsg = '';
  private saveMsgTimer: any;

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
    clearTimeout(this.saveMsgTimer);
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
    this.saveMsg = '';
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
      else { this.flashSaveMsg('SETTINGS.SAVE_MSG.LOCAL'); return; }
    }

    // Feedback puntual del clic (no del auto-save): a la nube solo si estás en modo
    // Supabase; en modo local el guardado remoto se omite y solo escribe en local.
    if (this.saveService.status$.value === 'error') {
      this.flashSaveMsg('SETTINGS.SAVE_MSG.ERROR');
    } else {
      this.flashSaveMsg(this.connection.useSupabase ? 'SETTINGS.SAVE_MSG.CLOUD' : 'SETTINGS.SAVE_MSG.LOCAL');
    }
  }

  /** Muestra un mensaje breve tras pulsar Guardar (se borra solo a los 3 s). */
  private flashSaveMsg(key: string): void {
    this.saveMsg = key;
    clearTimeout(this.saveMsgTimer);
    this.saveMsgTimer = setTimeout(() => this.saveMsg = '', 3000);
  }

  /** Cierra sesión y vuelve al login.
   *  - Cuenta con email: signOut real (se puede recuperar con email+contraseña).
   *  - Invitado (anónimo): NO se hace signOut — sin credenciales, destruir la sesión
   *    perdería la cuenta para siempre. Solo marcamos que el login no auto-entre,
   *    dejando la sesión viva; ahí saldrá "Continuar como invitado (ID)" para
   *    reanudarla. El modo de conexión NO se toca: se sigue en Supabase. */
  async logout(): Promise<void> {
    if (await this.supabase.getLocalGuestId()) {
      await this.connection.suppressAutoLogin();     // sin signOut: la sesión invitada sigue viva
    } else {
      await this.connection.logout();                // email: signOut normal
    }
    this.supabaseConnected = false;
    this.asgard.triggerCloseMenu();
    this.router.navigate(['/login']);
  }
}
