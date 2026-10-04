import { Injectable, NgZone, inject } from '@angular/core';
import Phaser from 'phaser';
import { PlanetViewScene } from '../scenes/planet-view.scene';

/**
 * Dueño ÚNICO del mini-juego Phaser del globo (panel del mapa del mundo).
 *
 * Antes cada apertura del panel hacía `new Phaser.Game` (contexto WebGL nuevo, arranque
 * de Phaser, texturas procedurales y subida a GPU) y lo destruía al cerrar: 1-2 s hasta
 * pintarse. Ahora la instancia vive toda la sesión:
 *  - Al CERRAR el panel se aparca (su div sale del DOM visible) y su bucle se duerme
 *    (`loop.sleep()` → cero coste de render mientras no se ve).
 *  - Al ABRIR se re-cuelga del panel, se despierta y se hace `scene.restart()` (rápido:
 *    contexto WebGL y texturas ya existen) para reorientar el globo al mapa actual y
 *    recalcular pines bloqueados.
 *  - `prewarm()` lo crea en segundo plano tras arrancar la partida, para que incluso la
 *    PRIMERA apertura sea instantánea.
 */
@Injectable({ providedIn: 'root' })
export class PlanetViewHostService {
  private ngZone = inject(NgZone);

  private game: Phaser.Game | null = null;
  /** Div que contiene el canvas. Se mueve entre el panel y el aparcamiento. */
  private host: HTMLDivElement | null = null;
  /** Aparcamiento fuera de pantalla (fuera de layout visible, pero en el DOM). */
  private parking: HTMLDivElement | null = null;
  /** Pausado por otra vista del panel (pestaña hexagonal): un restart no lo despierta. */
  private paused = false;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);   // = DPR de planet-view.scene

  get scene(): PlanetViewScene | null {
    return (this.game?.scene.getScene('PlanetViewScene') as PlanetViewScene) ?? null;
  }

  /** Registry del juego (callbacks Angular ↔ escena). */
  get registry(): Phaser.Data.DataManager | null {
    return this.game?.registry ?? null;
  }

  /** Crea la instancia en segundo plano (aparcada y dormida) con el tamaño que tendrá
   *  el globo. Idempotente. Lo llama el layout tras arrancar la partida. */
  prewarm(): void {
    if (this.game) return;
    const { w, h } = this.estimateSize();
    this.create(w, h, this.ensureParking());
    // Cuando termine de arrancar, a dormir hasta que se abra el panel. OJO: no vale
    // dormir en READY — Phaser emite READY y JUSTO DESPUÉS arranca el bucle
    // (Game.texturesReady → start()), y loop.sleep() no hace nada si aún no corre:
    // el globo se quedaba redibujándose a 30 fps fuera de pantalla toda la partida.
    // Se duerme tras el primer frame (escena ya creada y pintada = precalentada).
    this.game!.events.once(Phaser.Core.Events.READY, () => {
      this.game?.events.once(Phaser.Core.Events.POST_RENDER, () => {
        if (this.host?.parentElement === this.parking) this.game?.loop.sleep();
      });
    });
  }

  /** Cuelga el globo del panel (`parent` = #planet-view). `configure` registra los
   *  callbacks del componente en el registry ANTES de reiniciar la escena (la escena
   *  los lee en create: mapa actual, mapas bloqueados…). */
  attach(parent: HTMLElement, configure: (registry: Phaser.Data.DataManager) => void): void {
    const w = Math.max(1, Math.round(parent.clientWidth * this.dpr));
    const h = Math.max(1, Math.round(parent.clientHeight * this.dpr));
    if (!this.game) this.create(w, h, parent);
    else parent.appendChild(this.host!);

    configure(this.game!.registry);

    if (this.game!.isBooted) this.restartScene(w, h, true);
    // Si aún está arrancando (prewarm muy reciente / primera vez), su create() ya usará
    // el registry recién configurado: solo reiniciar si el tamaño no coincide.
    else this.game!.events.once(Phaser.Core.Events.READY, () => this.restartScene(w, h, false));
  }

  /** Duerme el bucle sin descolgar el canvas (otra vista lo tapa en el panel). */
  pause(): void {
    this.paused = true;
    this.game?.loop.sleep();
  }

  /** Despierta el bucle tras pause(). */
  resume(): void {
    this.paused = false;
    this.game?.loop.wake();
  }

  /** Al cerrar el panel: aparca el canvas y duerme el bucle (no se destruye). */
  detach(): void {
    if (!this.game || !this.host) return;
    this.game.loop.sleep();
    this.ensureParking().appendChild(this.host);
  }

  private restartScene(w: number, h: number, force: boolean): void {
    const game = this.game;
    if (!game) return;
    const resized = game.scale.width !== w || game.scale.height !== h;
    if (resized) game.scale.resize(w, h);
    game.loop.wake();
    if (force || resized) this.scene?.scene.restart();
    if (this.paused) game.loop.sleep();
  }

  private create(w: number, h: number, parent: HTMLElement): void {
    this.host = document.createElement('div');
    this.host.style.cssText = 'position:absolute;inset:0;';
    parent.appendChild(this.host);
    // Fuera de la zona de Angular: si no, zone.js dispara change detection en cada
    // frame del globo mientras se ve. Las actualizaciones de UI van en ngZone.run.
    this.ngZone.runOutsideAngular(() => {
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: this.host!,
        width: w,
        height: h,
        // Canvas a resolución nativa (devicePixelRatio) reducido con zoom CSS: si no,
        // el texto se ve borroso en pantallas de alta densidad.
        scale: { mode: Phaser.Scale.NONE, zoom: 1 / this.dpr },
        render: { antialias: true },
        backgroundColor: '#05060f',
        scene: [PlanetViewScene],
      });
    });
  }

  private ensureParking(): HTMLDivElement {
    if (!this.parking) {
      this.parking = document.createElement('div');
      // En el DOM (el canvas sigue siendo válido) pero invisible y sin interceptar toques.
      this.parking.style.cssText =
        'position:fixed;left:-20000px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;';
      document.body.appendChild(this.parking);
    }
    return this.parking;
  }

  /** Tamaño aproximado del área del globo (modal .world-map: 10px de margen, 54px de
   *  footer; marco y padding del panel ≈ 24px). Si al abrir no coincide, attach()
   *  hace resize + restart, que sigue siendo barato. */
  private estimateSize(): { w: number; h: number } {
    const cssW = Math.max(1, window.innerWidth - 20 - 24);
    const cssH = Math.max(1, window.innerHeight - 10 - 54 - 24);
    return { w: Math.round(cssW * this.dpr), h: Math.round(cssH * this.dpr) };
  }
}
