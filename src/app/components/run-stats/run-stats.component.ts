import { Component, EventEmitter, Output, inject } from '@angular/core';
import { map } from 'rxjs';
import { RunProgressService } from 'src/app/services/run-progress.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { UnlockService } from 'src/app/services/unlock.service';
import { RUN_MILESTONES, RunMilestoneDef } from 'src/app/services/run-milestones';
import { RUN_WEAPONS, RunWeaponDef, weaponStarsPerSec } from 'src/app/scenes/worldrun/run-weapons';
import { CompactNumberPipe } from 'src/app/pipes/compact-number.pipe';

/**
 * HUD de estadísticas del Modo Mundo (arriba a la derecha, solo en run-mode).
 * Maquetado como la barra de vida: un widget enmarcado (madera + piedra, SIN barras)
 * con los contadores en vivo (estrellas + enemigos abatidos) y un tirador que
 * despliega hacia abajo un panel de HITOS comprables con estrellas (el primero
 * desbloquea el impulso de exploración). El detalle (récord, muertes) vive en el
 * panel de la barra de vida (top-bar), no aquí.
 */
@Component({
  selector: 'app-run-stats',
  templateUrl: './run-stats.component.html',
  styleUrls: ['./run-stats.component.scss'],
  standalone: false,
})
export class RunStatsComponent {
  private runProgress  = inject(RunProgressService);
  private playerBridge = inject(PlayerBridgeService);
  private unlocks      = inject(UnlockService);
  private compact      = new CompactNumberPipe();   // formato k/M… para estrellas

  readonly milestones$ = this.runProgress.milestones$;

  /** Texto del total de estrellas de la barra. Si las ARMAS generan una fracción de
   *  estrella por segundo (0 < ★/s < 1), muestra 1 decimal de la fracción acumulada
   *  (starsDisplay = saldo + starCarry de armas) para que se vea subir; si no, entero.
   *  Se basa en la tasa de ARMAS a propósito: es la única fracción visible en el saldo. */
  starsShownText(): string {
    const rate = this.runProgress.weaponStarsPerSecTotal();
    if (rate > 0 && rate < 1) {
      // Fracción visible: el decimal solo aporta con saldos pequeños; en cuanto crece,
      // formato compacto (k/M…) como todo lo demás.
      const d = this.runProgress.starsDisplay();
      return d < 1000 ? d.toFixed(1) : this.compact.transform(d);
    }
    return this.compact.transform(this.runProgress.getStars());
  }

  /** Estadísticas de por vida de TODA la cuenta (suma de todos los personajes). Se
   *  refrescan con `changes$` (las stats por personaje las vuelca SaveService en cada
   *  guardado). Récord = la mejor marca de una sola carrera de cualquier personaje. */
  readonly stats$ = this.runProgress.changes$.pipe(map(() => ({
    record: this.runProgress.accountBestDistanceM(),
    kills:  this.runProgress.totalKills(),
    deaths: this.runProgress.totalDeaths(),
  })));

  readonly RUN_MILESTONES = RUN_MILESTONES;
  readonly RUN_WEAPONS = RUN_WEAPONS;

  /** Botón de ajustes del widget (en exploración no hay minimap): lo abre el layout. */
  @Output() openSettings = new EventEmitter<void>();

  /** Botón de mapa del widget: el layout abre el panel de mapa (world-map-panel). */
  @Output() openMap = new EventEmitter<void>();

  /** Click en el botón de mapa: con 1-1 comprado abre el mapa; si no, sale directo
   *  a la capital (Asgard) sin modal de confirmación. */
  onMapBtn(): void {
    if (this.runProgress.has('map_1_1')) this.openMap.emit();
    else this.playerBridge.requestExitRun();
  }

  panelOpen = false;
  togglePanel(): void { this.panelOpen = !this.panelOpen; }

  /** Pestaña activa del panel: objetivos (por comprar), completos (ya comprados),
   *  stats (estadísticas de por vida) o weapons (armas generadoras de oro). */
  tab: 'objetivos' | 'completos' | 'stats' | 'weapons' = 'weapons';

  // ── Armas (generadores de oro estilo Idle Slayer) ─────────────────────────────
  /** Armas que YA han aparecido: su umbral de desbloqueo (`unlockAtStars`) se cubre
   *  con el PICO de estrellas alcanzado a la vez. El pico es monotónico (no baja al
   *  gastar), así que una vez visible el arma se queda para siempre. Un RESET TOTAL de
   *  exploración pone el pico a 0 y las vuelve a ocultar hasta re-alcanzar el umbral. */
  unlockedWeapons(): RunWeaponDef[] { return this.runProgress.unlockedWeapons(); }
  weaponLevel(id: string): number { return this.runProgress.weaponLevel(id); }
  weaponCost(w: RunWeaponDef): number { return this.runProgress.weaponCost(w); }
  canBuyWeapon(w: RunWeaponDef): boolean { return this.runProgress.canBuyWeapon(w); }
  buyWeapon(w: RunWeaponDef): void { this.runProgress.buyWeapon(w); }
  /** Estrellas/seg que produce un arma a su nivel actual. */
  weaponRate(w: RunWeaponDef): number { return weaponStarsPerSec(w, this.weaponLevel(w.id)); }
  /** Estrellas/seg TOTAL de producción pasiva (armas + generadores de hitos). */
  starsPerSec(): number { return this.runProgress.starsPerSecTotal(); }

  /** Hitos ordenados por PRECIO ascendente (los más baratos arriba). Copia para no
   *  mutar RUN_MILESTONES. Empate de precio → mantiene el orden del array. */
  private byCost(): RunMilestoneDef[] {
    return [...RUN_MILESTONES].sort((a, b) => a.cost - b.cost);
  }

  /** Hitos a mostrar según la pestaña: objetivos = no comprados; completos = comprados.
   *  Ordenados por precio (más baratos primero). */
  forTab(owned: string[]): RunMilestoneDef[] {
    return this.byCost().filter(m =>
      this.tab === 'objetivos' ? !owned.includes(m.id) : owned.includes(m.id));
  }

  owned(id: string): boolean { return this.runProgress.has(id); }

  /** ¿Se puede comprar ahora? (no comprado + estrellas suficientes + prerrequisito
   *  comprado — los mapas van encadenados: 1-2 pide 1-1, etc.). */
  canBuy(m: RunMilestoneDef): boolean {
    if (this.owned(m.id) || this.runProgress.getStars() < m.cost) return false;
    return !m.requires || this.owned(m.requires);
  }

  /** ¿Queda algún hito comprable AHORA? (habilita el botón "comprar todo"). */
  canBuyAny(): boolean {
    return RUN_MILESTONES.some(m => this.canBuy(m));
  }

  /** Compra todos los hitos que se puedan pagar, de más BARATO a más caro (igual que se
   *  ven en la lista). Cada compra baja las estrellas, así que se re-evalúa `canBuy` en
   *  cada paso; una sola pasada basta porque los prerrequisitos (mapas encadenados) son
   *  más baratos que sus dependientes, así van antes. */
  buyAllAvailable(): void {
    for (const m of this.byCost()) {
      if (this.canBuy(m)) this.buy(m);
    }
  }

  buy(m: RunMilestoneDef): void {
    if (!this.runProgress.buy(m.id, m.cost)) return;
    // Hitos de mapa: marcar su flag desbloquea la feature 'map.X' (viajar al mapa).
    // Scope 'global': el flag es de CUENTA, así el mapa comprado en un personaje se
    // desbloquea para TODOS (la feature 'map.X', aunque sea 'char', se satisface con
    // el flag global — ver UnlockService.isSourceMet, que mira flagsChar || flagsGlobal).
    if (m.unlockFlag) this.unlocks.setFlag(m.unlockFlag, 'global');
  }
}
