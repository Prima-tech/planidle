import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { GameSettingsService } from 'src/app/services/game-settings.service';
import { ConnectionService } from 'src/app/services/connection.service';
import { SaveService } from 'src/app/services/save.service';
import { StorageService } from 'src/app/services/storage.service';
import { AppStyleService } from 'src/app/services/app-style.service';
import { QuestDef, QuestService } from 'src/app/services/quest.service';
import { AsgardService } from 'src/app/services/asgard';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { RunProgressService } from 'src/app/services/run-progress.service';
import { UnlockService } from 'src/app/services/unlock.service';
import { mapFeatureId } from 'src/app/services/unlock-config';
import { RUN_MILESTONES } from 'src/app/services/run-milestones';
import { PARALLAX_THEME_LIST } from 'src/app/scenes/gamescene/parallax-themes';
import { WORLD_PARALLAX_SETS } from 'src/app/scenes/worldrun/parallax-sets';

/**
 * Ventana de admin (lado derecho). Se abre desde el botón de arriba a la izquierda
 * del aro del minimapa. Contiene lo que antes eran las pestañas Admin y Estilos de
 * Ajustes; reutiliza la hoja de estilos de Ajustes para verse igual.
 */
@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['../../pages/game-settings/game-settings.page.scss'],
  standalone: false
})
export class AdminPanelComponent {
  /** Pestañas principales: 0 = Admin · 1 = Estilos · 2 = Avance (misiones). */
  tab: 0 | 1 | 2 = 0;
  /** Desplegable del Acto 1 en la pestaña Avance. */
  act1Open = true;
  /** Sub-pestañas de Admin: 0 = Admin (monedas, rejilla…) · 1 = Fondos (parallax)
   *  · 2 = Progreso (desbloqueo manual de features). */
  adminTab: 0 | 1 | 2 = 0;

  gs = inject(GameSettingsService);
  appStyle = inject(AppStyleService);
  quests = inject(QuestService);
  private connection = inject(ConnectionService);
  private saveService = inject(SaveService);
  private storage = inject(StorageService);
  private asgard = inject(AsgardService);
  private playerState = inject(PlayerStateService);
  private runProgress = inject(RunProgressService);
  private unlocks = inject(UnlockService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  /** Cantidad de monedas a regalar (1..1.000.000) seleccionada en la barra. */
  adminCoins = 1000;
  readonly ADMIN_COINS_MAX = 1_000_000;
  readonly parallaxThemes = PARALLAX_THEME_LIST;
  readonly worldParallaxSets = WORLD_PARALLAX_SETS;

  /** Nº de misiones del acto ya completadas. */
  doneCount(): number {
    return this.quests.chain().filter(q => this.quests.isCompleted(q)).length;
  }

  allDone(): boolean {
    const chain = this.quests.chain();
    return chain.length > 0 && chain.every(q => this.quests.isCompleted(q));
  }

  /** "+10 oro · +10 EXP · Mesa de trabajo ×1" para la fila de la misión. */
  rewardLabel(q: QuestDef): string {
    const r = q.reward;
    const t = (k: string) => this.translate.instant(k);
    const parts: string[] = [];
    if (r.coins) parts.push(`+${r.coins} ${t('ADMIN_PANEL.GOLD')}`);
    if (r.exp) parts.push(`+${r.exp} ${t('STAT.EXP_SHORT')}`);
    for (const it of r.items ?? []) parts.push(`${it.name} ×${it.qty}`);
    return parts.join(' · ');
  }

  /** Suma al personaje activo la cantidad de monedas de la barra. */
  grantCoins(): void {
    const amount = Math.max(1, Math.min(this.ADMIN_COINS_MAX, Math.floor(this.adminCoins) || 0));
    this.playerState.collectCoins(amount);
  }

  /**
   * RESET TOTAL del Modo Exploración. Deja la progresión del runner como recién
   * empezada — 0 estrellas, sin hitos ni armas (0 ★/min), y "descompra" los mapas
   * (re-bloquea 1-1..1-8). Sobrescribe la nube para que no se re-infle al re-loguear.
   */
  async resetExploration(): Promise<void> {
    if (!confirm(this.translate.instant('SETTINGS.CONFIRM.RESET_EXPLORATION'))) return;
    this.runProgress.resetExploration();
    // Quita los flags de mapa comprados y re-bloquea sus features (mapas 1-1..1-8).
    const mapFlags = RUN_MILESTONES
      .map(m => m.unlockFlag)
      .filter((f): f is string => !!f);
    const mapFeatures = mapFlags.map(f => mapFeatureId(f.slice('map_'.length).replace('_', '-')));
    this.unlocks.resetUnlocks(mapFlags, mapFeatures);
    // restore() es aditivo: sin pisar la nube, al re-loguear volvería a inflarse.
    await this.saveService.forceSave(true);
  }

  /** Borra TODO el almacenamiento local (localStorage + Ionic Storage con las
   *  partidas locales) y cierra sesión. Recarga la app en el login para que ningún
   *  servicio siga con el estado viejo en memoria (ni el auto-save lo re-escriba). */
  async clearLocalStorage(): Promise<void> {
    if (!confirm(this.translate.instant('SETTINGS.CONFIRM.CLEAR_LOCAL'))) return;
    try {
      await this.connection.logout();   // signOut antes de borrar (necesita la sesión)
    } catch (e) {
      console.warn('[Admin] signOut falló al borrar el almacenamiento local', e);
    }
    try { localStorage.clear(); } catch { /* sin acceso a localStorage */ }
    try { await this.storage.clear(); } catch (e) { console.warn('[Admin] No se pudo vaciar Storage', e); }
    this.asgard.triggerCloseMenu();
    await this.router.navigate(['/login']);
    location.reload();
  }
}
