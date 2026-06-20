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
import { enemySpriteStyle, enemySpriteClass } from 'src/app/utils/enemy-sprite.utils';
import { UnlockService } from 'src/app/services/unlock.service';
import { mapFeatureId } from 'src/app/services/unlock-config';

interface MapPin {
  id: string;
  name: string;
  x: number;
  y: number;
}

const MAP_PINS: MapPin[] = [
  { id: 'hogar', name: 'Asgard', x: 50, y: 15 },
  { id: '1-1',   name: '1-1',  x: 10, y: 60 },
  { id: '1-2',   name: '1-2',  x: 22, y: 45 },
  { id: '1-3',   name: '1-3',  x: 33, y: 65 },
  { id: '1-4',   name: '1-4',  x: 46, y: 50 },
  { id: '1-5',   name: '1-5',  x: 57, y: 75 },
  { id: '1-6',   name: '1-6',  x: 66, y: 58 },
  { id: '1-7',   name: '1-7',  x: 77, y: 78 },
  { id: '1-8',   name: '1-8',  x: 88, y: 62 },
];

const DISPLAY_PX = 48;

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
  private ngZone        = inject(NgZone);
  private mapSub: Subscription;

  activeTab    = 0;
  currentMapId = '';
  selectedMap: MapConfig | null = null;
  charsOnMap: CharOnMap[] = [];

  selectedPlanet: { id: string; name: string } | null = null;
  charsOnPlanet: CharOnMap[] = [];

  // Planeta cuyo globo se está viendo en la vista detalle (lo reporta la escena).
  // Determina la lista de mapas que se muestra a la izquierda del globo.
  detailPlanetId = '';

  private planetGame: Phaser.Game | null = null;

  readonly pins = MAP_PINS;

  ngOnInit() {
    this.mapSub = this.worldService.currentMap$.subscribe(m => {
      this.currentMapId = m.id;
    });
  }

  ngOnDestroy() {
    this.mapSub?.unsubscribe();
    this.destroyPlanetGame();
  }

  selectTab(index: number) {
    if (this.activeTab === index) return;
    this.activeTab = index;
    if (index === 2) {
      this.selectedMap = null;
      this.charsOnMap  = [];
      // El contenedor entra al DOM con el *ngIf en este mismo ciclo
      setTimeout(() => this.createPlanetGame());
    } else {
      this.destroyPlanetGame();
    }
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
    // La escena nos dice qué planeta se está viendo → lista de mapas a la izquierda.
    this.planetGame.registry.set(PLANET_DETAIL_KEY, (planetId: string) => {
      this.ngZone.run(() => { this.detailPlanetId = planetId; });
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

  /** Pinchar un mapa de la lista: gira el globo para centrar su pin. */
  focusPlanetMap(mapId: string) {
    const scene = this.planetGame?.scene.getScene('PlanetViewScene') as PlanetViewScene | undefined;
    scene?.focusMap(mapId, true);
  }

  private destroyPlanetGame() {
    this.planetGame?.destroy(true);
    this.planetGame = null;
    this.selectedPlanet = null;
    this.charsOnPlanet  = [];
    this.detailPlanetId = '';
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
    const mapIds  = PLANET_MAPS[planetId] ?? [];
    const chars   = (await this.asgard.getCharacters()) ?? [];
    const current = String(this.asgard.selectedPlayer?.id ?? '');
    const result: CharOnMap[] = [];

    for (const char of chars) {
      if (!char?.id || !char?.name) continue;
      const id = String(char.id);

      if (id === current) {
        if (mapIds.includes(this.currentMapId))
          result.push({ name: char.name, isCurrent: true, equipment: null });
      } else {
        const snap = await this.storage.get(`snapshot_char_${id}`);
        if (snap?.mapId && mapIds.includes(snap.mapId))
          result.push({ name: char.name, isCurrent: false, equipment: snap.equipment ?? {} });
      }
    }

    this.charsOnPlanet = result;
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
    const chars   = (await this.asgard.getCharacters()) ?? [];
    const current = String(this.asgard.selectedPlayer?.id ?? '');
    const result: CharOnMap[] = [];

    for (const char of chars) {
      if (!char?.id || !char?.name) continue;
      const id = String(char.id);

      if (id === current) {
        if (mapId === this.currentMapId)
          result.push({ name: char.name, isCurrent: true, equipment: null });
      } else {
        const snap = await this.storage.get(`snapshot_char_${id}`);
        if (snap?.mapId === mapId)
          result.push({ name: char.name, isCurrent: false, equipment: snap.equipment ?? {} });
      }
    }

    this.charsOnMap = result;
  }

  /** ¿El mapa está bloqueado? 'hogar' (sin feature) siempre cuenta como libre;
   *  los 1-x están bloqueados hasta desbloquear su feature (p.ej. 1-1 a los 100 m). */
  isMapLocked(pinId: string): boolean {
    return !this.unlocks.isUnlocked(mapFeatureId(pinId));
  }

  teleport(pinId: string) {
    if (pinId === this.currentMapId) return;
    if (this.isMapLocked(pinId)) return;   // destino bloqueado: no se puede viajar
    this.worldService.setCurrentMap(pinId);
    this.playerBridge.restartGameScene();
  }

  spriteStyle(enemyType: string) { return enemySpriteStyle(enemyType, DISPLAY_PX); }
  spriteClass(enemyType: string) { return enemySpriteClass(enemyType); }
}
