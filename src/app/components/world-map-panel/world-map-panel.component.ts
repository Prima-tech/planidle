import { Component, inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import Phaser from 'phaser';
import { PlanetViewScene, PLANET_PIN_SELECT_KEY, PLANET_PIN_TELEPORT_KEY, PLANET_SELECT_KEY, PLANET_ZOOM_KEY, PLANET_MAP_LOCKED_KEY, PLANET_CURRENT_MAP_KEY, PLANET_DETAIL_KEY } from 'src/app/scenes/planet-view.scene';
import { WorldService } from 'src/app/services/world.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { AsgardService } from 'src/app/services/asgard';
import { StorageService } from 'src/app/services/storage.service';
import { EquipmentSnapshot } from 'src/app/services/equipment.service';
import { MAP_REGISTRY, MapConfig } from 'src/app/scenes/gamescene/map-config';
import { miningTier, gemTier, treeTier } from 'src/app/scenes/gamescene/harvest-config';
import { enemySpriteStyle, enemySpriteClass } from 'src/app/utils/enemy-sprite.utils';
import { UnlockService } from 'src/app/services/unlock.service';
import { mapFeatureId } from 'src/app/services/unlock-config';
import { AdminService } from 'src/app/services/admin.service';

// Tamaño al que se renderiza cada frame del sprite del enemigo en la tarjeta de
// info. El recuadro (.enemy-frame) recorta; con 96 el bicho se ve al doble.
const DISPLAY_PX = 96;

// Qué mapas pertenecen a cada planeta (para saber qué personajes están en él).
// Al añadir mapas a un planeta nuevo, registrarlos aquí.
const PLANET_MAPS: Record<string, string[]> = {
  mundo: ['hogar', '1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8'],
};

export interface CharOnMap {
  name: string;
  isCurrent: boolean;
  equipment: EquipmentSnapshot | null; // null = personaje activo (reactivo)
}

@Component({
  selector: 'app-world-map-panel',
  templateUrl: './world-map-panel.component.html',
  styleUrls: ['./world-map-panel.component.scss'],
  standalone: false
})
export class WorldMapPanelComponent implements OnInit, OnDestroy {
  private worldService  = inject(WorldService);
  private playerBridge  = inject(PlayerBridgeService);
  private asgard        = inject(AsgardService);
  private storage       = inject(StorageService);
  private unlocks       = inject(UnlockService);
  private admin         = inject(AdminService);
  private ngZone        = inject(NgZone);
  private mapSub: Subscription;

  currentMapId = '';
  selectedMap: MapConfig | null = null;
  charsOnMap: CharOnMap[] = [];

  selectedPlanet: { id: string; name: string } | null = null;
  charsOnPlanet: CharOnMap[] = [];

  // DEBUG: estado de la cuadrícula del globo (arranca igual que DEBUG_PIN_GRID en la escena).
  gridOn = true;

  // Planeta cuyo globo se está viendo en la vista detalle (lo reporta la escena).
  // Determina la lista de mapas que se muestra a la izquierda del globo.
  detailPlanetId = '';
  // Nombre del planeta en vista detalle: lo pinta Angular como título sobre el globo
  // (antes lo dibujaba la propia escena Phaser).
  detailPlanetName = '';

  private planetGame: Phaser.Game | null = null;

  ngOnInit() {
    let first = true;
    this.mapSub = this.worldService.currentMap$.subscribe(m => {
      this.currentMapId = m.id;
      // Al abrir el panel, dejar seleccionado (resaltado en la lista de la izquierda)
      // el mapa donde está el jugador ahora mismo.
      if (first) {
        first = false;
        if (MAP_REGISTRY[m.id]) {
          this.selectedMap = MAP_REGISTRY[m.id];
          this.loadCharsOnMap(m.id);
        }
      }
    });
    // Única vista del panel = el globo del planeta. Se crea tras el primer ciclo,
    // cuando #planet-view ya está en el DOM.
    setTimeout(() => this.createPlanetGame());
  }

  ngOnDestroy() {
    this.mapSub?.unsubscribe();
    this.destroyPlanetGame();
  }

  private createPlanetGame() {
    const parent = document.getElementById('planet-view');
    if (!parent || this.planetGame) return;
    // Canvas a resolución nativa del dispositivo (devicePixelRatio) y reducido
    // con zoom CSS — sin esto el texto se ve borroso en pantallas de alta densidad
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    // Fuera de la zona de Angular: si no, zone.js dispara change detection en cada
    // frame del globo mientras el panel está abierto. Las actualizaciones de UI de
    // este panel son discretas y ya van envueltas en ngZone.run (ver más abajo).
    this.ngZone.runOutsideAngular(() => {
      this.planetGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width:  parent.clientWidth * dpr,
        height: parent.clientHeight * dpr,
        scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
        render: { antialias: true },
        backgroundColor: '#05060f',
        scene: [PlanetViewScene],
      });
    });
    // Pin pulsado en el globo → misma tarjeta de info (y teleport) que la tab 0.
    // El click llega desde Phaser (fuera de Angular): hace falta ngZone.run
    // para que la change detection pinte la tarjeta.
    // El globo pinta en gris los mapas bloqueados y no extiende la ruta hasta ellos.
    this.planetGame.registry.set(PLANET_MAP_LOCKED_KEY, (mapId: string) => this.isMapLocked(mapId));
    this.planetGame.registry.set(PLANET_PIN_SELECT_KEY, (mapId: string) => {
      this.ngZone.run(() => this.selectPin(mapId));
    });
    this.planetGame.registry.set(PLANET_PIN_TELEPORT_KEY, (mapId: string) => {
      this.ngZone.run(() => this.teleport(mapId));
    });
    this.planetGame.registry.set(PLANET_SELECT_KEY, (id: string, name: string) => {
      this.ngZone.run(() => this.selectPlanet(id, name));
    });
    // Doble click en un planeta: la escena hace el zoom; aquí solo se cierra la tarjeta
    this.planetGame.registry.set(PLANET_ZOOM_KEY, () => {
      this.ngZone.run(() => {
        this.selectedPlanet = null;
        this.charsOnPlanet  = [];
      });
    });
    // Al abrir el globo, la escena se orienta al mapa donde está el jugador (o a la
    // capital del planeta si no es válido); le damos ese mapId vía este callback.
    this.planetGame.registry.set(PLANET_CURRENT_MAP_KEY, () => this.currentMapId);
    // La escena nos dice qué planeta se está viendo → lista de mapas + título del nombre.
    this.planetGame.registry.set(PLANET_DETAIL_KEY, (planetId: string, name: string) => {
      this.ngZone.run(() => { this.detailPlanetId = planetId; this.detailPlanetName = name; });
    });
  }

  /** Mapas DESBLOQUEADOS del planeta que se está viendo, para la lista de la izquierda
   *  del globo. Pinchar uno gira el globo hacia su pin (focusPlanetMap). */
  get planetMapList(): { id: string; name: string; current: boolean }[] {
    const ids = PLANET_MAPS[this.detailPlanetId] ?? [];
    return ids
      .filter(id => !this.isMapLocked(id))
      .map(id => ({
        id,
        name: MAP_REGISTRY[id]?.name ?? id,
        current: id === this.currentMapId,
      }));
  }

  /** Pinchar un mapa de la lista: gira el globo para centrar su pin y deja ese mapa
   *  SELECCIONADO de forma fija (resaltado estático en la lista), sin alternar. */
  focusPlanetMap(mapId: string) {
    const scene = this.planetGame?.scene.getScene('PlanetViewScene') as PlanetViewScene | undefined;
    scene?.focusMap(mapId, true);
    if (this.selectedMap?.id !== mapId) {
      this.selectedMap = MAP_REGISTRY[mapId];
      this.loadCharsOnMap(mapId);
    }
  }

  private destroyPlanetGame() {
    this.planetGame?.destroy(true);
    this.planetGame = null;
    this.selectedPlanet = null;
    this.charsOnPlanet  = [];
    this.detailPlanetId = '';
    this.detailPlanetName = '';
  }

  // ── Tarjeta de info del planeta (vista sistema, tab 2) ─────────────────────

  async selectPlanet(id: string, name: string) {
    if (this.selectedPlanet?.id === id) {
      this.selectedPlanet = null;
      this.charsOnPlanet  = [];
      return;
    }
    this.selectedPlanet = { id, name };
    await this.loadCharsOnPlanet(id);
  }

  private async loadCharsOnPlanet(planetId: string) {
    const mapIds = PLANET_MAPS[planetId] ?? [];
    this.charsOnPlanet = await this.loadCharsWhere(m => mapIds.includes(m));
  }

  /** DEBUG: alterna la cuadrícula de coordenadas del globo (llama a la escena). */
  toggleGrid() {
    this.gridOn = !this.gridOn;
    const scene = this.planetGame?.scene.getScene('PlanetViewScene') as PlanetViewScene | undefined;
    scene?.setDebugGrid(this.gridOn);
  }

  /** Botón de la tarjeta: hace el zoom-in a la vista detalle del planeta */
  visitPlanet() {
    if (!this.selectedPlanet || !this.planetGame) return;
    const scene = this.planetGame.scene.getScene('PlanetViewScene') as PlanetViewScene;
    scene?.zoomToPlanet(this.selectedPlanet.id);
    this.selectedPlanet = null;
    this.charsOnPlanet  = [];
  }

  async selectPin(pinId: string) {
    const cfg = MAP_REGISTRY[pinId];
    if (this.selectedMap?.id === pinId) {
      this.selectedMap = null;
      this.charsOnMap  = [];
    } else {
      this.selectedMap = cfg;
      await this.loadCharsOnMap(pinId);
    }
  }

  private async loadCharsOnMap(mapId: string) {
    this.charsOnMap = await this.loadCharsWhere(m => m === mapId);
  }

  /** Recorre el roster y devuelve los personajes cuyo mapa cumple `matches`.
   *  El personaje activo usa `currentMapId` (reactivo, equipment null); el resto
   *  lee su snapshot persistido. Lo comparten la tarjeta de mapa y la de planeta. */
  private async loadCharsWhere(matches: (mapId: string) => boolean): Promise<CharOnMap[]> {
    const chars   = (await this.asgard.getCharacters()) ?? [];
    const current = String(this.asgard.selectedPlayer?.id ?? '');
    const result: CharOnMap[] = [];

    for (const char of chars) {
      if (!char?.id || !char?.name) continue;
      const id = String(char.id);

      if (id === current) {
        if (matches(this.currentMapId))
          result.push({ name: char.name, isCurrent: true, equipment: null });
      } else {
        const snap = await this.storage.get(`snapshot_char_${id}`);
        if (snap?.mapId && matches(snap.mapId))
          result.push({ name: char.name, isCurrent: false, equipment: snap.equipment ?? {} });
      }
    }

    return result;
  }

  /** ¿El mapa está bloqueado? 'hogar' (sin feature) siempre cuenta como libre;
   *  los 1-x están bloqueados hasta desbloquear su feature (p.ej. 1-1 a los 100 m). */
  isMapLocked(pinId: string): boolean {
    if (this.admin.isAdmin) return false;   // admin: todos los mapas desbloqueados
    return !this.unlocks.isUnlocked(mapFeatureId(pinId));
  }

  /** ¿Mostrar el botón de teletransporte a este mapa? Desbloqueado y (explorando, o
   *  no es el mapa actual). En exploración currentMapId está obsoleto (sigue siendo el
   *  de origen), así que se ofrece también la capital (Asgard) para poder volver. */
  canTeleport(pinId: string): boolean {
    if (this.isMapLocked(pinId)) return false;
    return this.playerBridge.runMode$.value || pinId !== this.currentMapId;
  }

  teleport(pinId: string) {
    if (this.isMapLocked(pinId)) return;   // destino bloqueado: no se puede viajar
    // En modo exploración la escena activa es WorldRunScene (no GameScene) y
    // `currentMapId` está OBSOLETO (sigue siendo el mapa desde el que entraste, p.ej.
    // Asgard) → el guard `pinId === currentMapId` bloquearía viajar a Asgard y
    // `restartGameScene` no saldría del runner. Salimos del runner al mapa elegido
    // (fade + GameScene, vía enterMap) y cerramos el panel del mapa.
    if (this.playerBridge.runMode$.value) {
      this.playerBridge.requestEnterMap(pinId);
      this.playerBridge.requestCloseMenus();
      return;
    }
    if (pinId === this.currentMapId) return;
    this.worldService.setCurrentMap(pinId);
    this.playerBridge.restartGameScene();
  }

  /** Tamaño de render por tipo en la tarjeta: base DISPLAY_PX (96), con retoques —
   *  los slimes un poco más pequeños y las ratas un poco más grandes. */
  private enemyDisplayPx(enemyType: string): number {
    if (enemyType.startsWith('slime')) return 84;
    if (enemyType.startsWith('rats'))  return 108;
    return DISPLAY_PX;
  }

  /** Recursos recolectables que spawnean en el mapa seleccionado (mina/árbol/gema),
   *  derivados de sus tiers. El hogar (Asgard) no genera recursos. */
  get mapResources(): { type: string; img: string }[] {
    const m = this.selectedMap;
    if (!m || m.id === 'hogar') return [];
    const res: { type: string; img: string }[] = [
      { type: 'Mina',  img: this.harvestImg(miningTier(m.mineTier).rockTexture) },
      { type: 'Árbol', img: this.harvestImg(treeTier(m.treeTier).rockTexture) },
    ];
    const gem = gemTier(m.gemTier);
    if (gem) res.push({ type: 'Gema', img: this.harvestImg(gem.rockTexture) });
    return res;
  }

  /** Ruta del sprite a partir de la clave de textura del recurso (misma fuente de
   *  verdad que el juego: harvest-config). Así el detalle del mapa nunca se
   *  desincroniza al reordenar tiers.  rock_tier3 → rocks/tier3_rock.png,
   *  rock_gem2 → rocks/gem2_rock.png, tree_tier1 → trees/tree_tier1.png */
  private harvestImg(textureKey: string): string {
    if (textureKey.startsWith('rock_')) {
      return `assets/sprites/map/skills/rocks/${textureKey.slice('rock_'.length)}_rock.png`;
    }
    if (textureKey.startsWith('tree_')) {
      return `assets/sprites/map/skills/trees/${textureKey}.png`;
    }
    return '';
  }

  spriteStyle(enemyType: string) {
    const px = this.enemyDisplayPx(enemyType);
    // width/height inline = un frame: el .enemy-frame recorta y centra el sprite.
    return { ...enemySpriteStyle(enemyType, px), width: `${px}px`, height: `${px}px` };
  }
  spriteClass(enemyType: string) { return enemySpriteClass(enemyType); }
}
