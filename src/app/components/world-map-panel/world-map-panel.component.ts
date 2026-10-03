import { Component, inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { PLANET_PIN_SELECT_KEY, PLANET_PIN_TELEPORT_KEY, PLANET_SELECT_KEY, PLANET_ZOOM_KEY, PLANET_MAP_LOCKED_KEY, PLANET_CURRENT_MAP_KEY, PLANET_SELECTED_MAP_KEY, PLANET_DETAIL_KEY, PLANET_LAYER_KEY, PLANET_FLAT_KEY, PLANET_FLAT_LOCK_KEY, PLANET_MODE_KEY, PLANET_EMPTY_TAP_KEY, ViewMode, PLANET_ZOOM_CHANGED_KEY, EARTH_ZOOM_MIN, EARTH_ZOOM_MAX } from 'src/app/scenes/planet-view.scene';
import { GlobeLayer } from 'src/app/scenes/earth-globe';
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
import { GameSettingsService } from 'src/app/services/game-settings.service';
import { PlanetViewHostService } from 'src/app/services/planet-view-host.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { prewarmCharacterSprite } from 'src/app/components/character-sprite/character-sprite.component';
import { MapDominionService } from 'src/app/services/map-dominion.service';
import { ENEMY_REGISTRY } from 'src/app/enemy/enemy-config';
import { LOOT_TABLES } from 'src/app/physics/griddrops';

// Tamaño al que se renderiza cada frame del sprite del enemigo en la tarjeta de
// info. El recuadro (.enemy-frame) recorta; con 96 el bicho se ve al doble.
const DISPLAY_PX = 96;

// Qué mapas pertenecen a cada planeta (para saber qué personajes están en él).
// Al añadir mapas a un planeta nuevo, registrarlos aquí.
const PLANET_MAPS: Record<string, string[]> = {
  mundo: ['hogar', '1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8'],
};

/** Entrada de la lista de mapas del planeta (columna izquierda del globo). */
interface PlanetMapEntry {
  id: string;
  name: string;
  current: boolean;
  tier: number | null;   // nº de mapa ('1-3' → 3); null en el hogar
}

/** Personaje del roster con su mapa (null en el activo: se usa currentMapId). */
interface RosterEntry {
  name: string;
  isCurrent: boolean;
  mapId: string | null;
  equipment: EquipmentSnapshot | null;   // null = personaje activo (reactivo)
}

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
  private gs            = inject(GameSettingsService);
  private ngZone        = inject(NgZone);
  private planetHost    = inject(PlanetViewHostService);
  private dominion      = inject(MapDominionService);
  private equipment     = inject(EquipmentService);

  /** Roster con el mapa de cada personaje, leído UNA vez al abrir el panel (en
   *  paralelo). Pinchar mapas filtra esta lista al instante, sin volver a leer los
   *  snapshots del almacenamiento. El activo sigue a `currentMapId` en vivo. */
  private roster: RosterEntry[] | null = null;
  private rosterLoad: Promise<RosterEntry[]> | null = null;
  private mapSub: Subscription;

  currentMapId = '';
  selectedMap: MapConfig | null = null;
  charsOnMap: CharOnMap[] = [];

  selectedPlanet: { id: string; name: string } | null = null;
  charsOnPlanet: CharOnMap[] = [];

  /** Capa del globo de la Tierra: base (mundo), Economía o Guerra. Estática → se
   *  recuerda entre aperturas del panel durante la sesión. */
  private static lastLayer: GlobeLayer = 'base';
  layer: GlobeLayer = WorldMapPanelComponent.lastLayer;
  /** Globo o mapa plano (las tres capas existen en ambas proyecciones). */
  private static lastFlat = true;   // el mapa se abre de inicio en plano
  flat = WorldMapPanelComponent.lastFlat;
  /** Candado del mapa plano: cerrado = estático y encuadrado; abierto = se mueve y
   *  tiene zoom. Arranca cerrado. */
  private static lastFlatLocked = true;
  flatLocked = WorldMapPanelComponent.lastFlatLocked;
  /** Vista actual de la escena: el «+» (alejar) se desactiva en la galaxia y el «−»
   *  (acercar) en el planeta, que son los extremos. */
  sceneMode: ViewMode = 'detail';

  /** Zoom del globo (barra inferior). La escena arranca siempre en 1 al abrir. */
  readonly zoomMin = EARTH_ZOOM_MIN;
  readonly zoomMax = EARTH_ZOOM_MAX;
  zoom = 1;

  // DEBUG: estado de la cuadrícula del globo (arranca igual que DEBUG_PIN_GRID en la escena).
  gridOn = false;

  // Planeta cuyo globo se está viendo en la vista detalle (lo reporta la escena).
  // Determina la lista de mapas que se muestra a la izquierda del globo.
  detailPlanetId = '';
  // Nombre del planeta en vista detalle: lo pinta Angular como título sobre el globo
  // (antes lo dibujaba la propia escena Phaser).
  detailPlanetName = '';

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
    // Roster + sprites listos antes del primer toque en un mapa
    this.ensureRoster();
  }

  ngOnDestroy() {
    this.mapSub?.unsubscribe();
    this.destroyPlanetGame();
  }

  /** Cuelga el globo (instancia Phaser compartida y ya precalentada, ver
   *  PlanetViewHostService) del panel y registra los callbacks de este componente. */
  private createPlanetGame() {
    const parent = document.getElementById('planet-view');
    if (!parent) return;
    this.planetHost.attach(parent, registry => {
      // Pin pulsado en el globo → misma tarjeta de info (y teleport) que la tab 0.
      // El click llega desde Phaser (fuera de Angular): hace falta ngZone.run
      // para que la change detection pinte la tarjeta.
      // El globo pinta en gris los mapas bloqueados y no extiende la ruta hasta ellos.
      registry.set(PLANET_MAP_LOCKED_KEY, (mapId: string) => this.isMapLocked(mapId));
      registry.set(PLANET_LAYER_KEY, this.layer);
      registry.set(PLANET_FLAT_KEY, this.flat);
      registry.set(PLANET_FLAT_LOCK_KEY, this.flatLocked);
      registry.set(PLANET_EMPTY_TAP_KEY, () => {
        this.ngZone.run(() => { this.closeMapList(); this.deselectMap(); });
      });
      registry.set(PLANET_MODE_KEY, (m: ViewMode) => {
        this.ngZone.run(() => { this.sceneMode = m; });
      });
      // Rueda / pellizco en la escena → mover la barra de zoom
      registry.set(PLANET_ZOOM_CHANGED_KEY, (z: number) => {
        this.ngZone.run(() => { this.zoom = z; });
      });
      registry.set(PLANET_PIN_SELECT_KEY, (mapId: string) => {
        this.ngZone.run(() => { this.closeMapList(); this.selectPin(mapId); });
      });
      registry.set(PLANET_PIN_TELEPORT_KEY, (mapId: string) => {
        this.ngZone.run(() => this.teleport(mapId));
      });
      registry.set(PLANET_SELECT_KEY, (id: string, name: string) => {
        this.ngZone.run(() => this.selectPlanet(id, name));
      });
      // Doble click en un planeta: la escena hace el zoom; aquí solo se cierra la tarjeta
      registry.set(PLANET_ZOOM_KEY, () => {
        this.ngZone.run(() => {
          this.selectedPlanet = null;
          this.charsOnPlanet  = [];
        });
      });
      // Al abrir el globo, la escena se orienta al mapa donde está el jugador (o a la
      // capital del planeta si no es válido); le damos ese mapId vía este callback.
      registry.set(PLANET_CURRENT_MAP_KEY, () => this.currentMapId);
      registry.set(PLANET_SELECTED_MAP_KEY, () => this.selectedMap?.id ?? null);
      // La escena nos dice qué planeta se está viendo → lista de mapas + título del nombre.
      registry.set(PLANET_DETAIL_KEY, (planetId: string, name: string) => {
        this.ngZone.run(() => { this.detailPlanetId = planetId; this.detailPlanetName = name; });
      });
    });
    // La instancia se reutiliza: el botón de debug refleja el estado real del grid.
    const scene = this.planetHost.scene;
    if (scene) this.gridOn = scene.debugGridOn;
  }

  /** Pestañas de capa del globo (botón = inicial del nombre traducido). */
  readonly layers: { id: GlobeLayer; key: string }[] = [
    { id: 'base',    key: 'MAP.LAYER_NORMAL' },
    { id: 'economy', key: 'MAP.LAYER_ECONOMY' },
    { id: 'war',     key: 'MAP.LAYER_WAR' },
  ];

  /** Activa una capa del globo. La escena lee la capa del registry en cada frame. */
  /** Barra de zoom: arrastrar el deslizador. */
  onZoomInput(ev: Event) {
    this.applyZoom(+(ev.target as HTMLInputElement).value);
  }

  /** Botones −/+ de la barra: un paso de zoom (×1.25). */
  stepZoom(dir: 1 | -1) {
    this.applyZoom(this.zoom * Math.pow(1.25, dir));
  }

  private applyZoom(z: number) {
    this.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, z));
    this.planetHost.scene?.setEarthZoom(this.zoom, false);
  }

  /** Botón «−»: acerca la vista un nivel (galaxia → constelación → sistema → planeta). */
  zoomInView() {
    this.planetHost.scene?.zoomInView();
  }

  /** Botón «+»: aleja la vista un nivel (planeta → sistema → constelación → galaxia). */
  zoomOutView() {
    this.planetHost.scene?.zoomOutView();
  }

  /** Botón globo ⇄ plano: mantiene la capa, el zoom y la zona centrada. */
  toggleFlatLock() {
    this.flatLocked = WorldMapPanelComponent.lastFlatLocked = !this.flatLocked;
    this.planetHost.registry?.set(PLANET_FLAT_LOCK_KEY, this.flatLocked);
  }

  /** ¿Hay zoom en la vista actual? Globo siempre; plano solo con el candado abierto. */
  get canZoom(): boolean {
    return !this.flat || !this.flatLocked;
  }

  toggleFlat() {
    this.flat = WorldMapPanelComponent.lastFlat = !this.flat;
    this.planetHost.registry?.set(PLANET_FLAT_KEY, this.flat);
  }

  setLayer(layer: GlobeLayer) {
    this.layer = WorldMapPanelComponent.lastLayer = layer;
    this.planetHost.registry?.set(PLANET_LAYER_KEY, layer);
  }

  /** Desplegable de mapas disponibles (columna izquierda): abierto o contraído.
   *  Estático → se recuerda entre aperturas del panel durante la sesión. */
  private static lastMapListOpen = false;
  mapListOpen = WorldMapPanelComponent.lastMapListOpen;

  toggleMapList() {
    this.mapListOpen = WorldMapPanelComponent.lastMapListOpen = !this.mapListOpen;
  }

  /** Pliega el desplegable de mapas: al tocar el mapa (pin o zona vacía). */
  private closeMapList() {
    this.mapListOpen = WorldMapPanelComponent.lastMapListOpen = false;
  }

  /** Pips de dificultad de cada fila (tier 1..8 → tantos encendidos). */
  readonly tierPips = [0, 1, 2, 3, 4, 5, 6, 7];

  /** Mapa donde está el jugador, cabecera de la columna izquierda. null si el jugador
   *  no está en este planeta. */
  get currentEntry(): PlanetMapEntry | null {
    return this.planetMapList.find(m => m.current) ?? null;
  }

  /** Resto de mapas disponibles (sin el actual), para el desplegable. */
  get otherMaps(): PlanetMapEntry[] {
    return this.planetMapList.filter(m => !m.current);
  }

  /** Mapas DESBLOQUEADOS del planeta que se está viendo, para la lista de la izquierda
   *  del globo. Pinchar uno gira el globo hacia su pin (focusPlanetMap). El tier sale
   *  del nº de mapa ('1-3' → 3); el hogar no tiene. */
  get planetMapList(): PlanetMapEntry[] {
    const ids = PLANET_MAPS[this.detailPlanetId] ?? [];
    return ids
      .filter(id => !this.isMapLocked(id))
      .map(id => ({
        id,
        name: MAP_REGISTRY[id]?.name ?? id,
        current: id === this.currentMapId,
        tier: +(/^\d+-(\d+)$/.exec(id)?.[1] ?? 0) || null,
      }));
  }

  /** Pinchar un mapa de la lista: gira el globo para centrar su pin y deja ese mapa
   *  SELECCIONADO de forma fija (resaltado estático en la lista), sin alternar. */
  focusPlanetMap(mapId: string) {
    const scene = this.planetHost.scene;
    scene?.focusMap(mapId, true);
    if (this.selectedMap?.id !== mapId) {
      this.selectedMap = MAP_REGISTRY[mapId];
      this.loadCharsOnMap(mapId);
    }
  }

  /** Al cerrar: el globo NO se destruye, se aparca dormido para la próxima apertura.
   *  Los callbacks del registry apuntan a este componente: se neutralizan para que
   *  ningún evento rezagado actúe sobre un panel ya destruido. */
  private destroyPlanetGame() {
    const reg = this.planetHost.registry;
    if (reg) for (const k of [PLANET_PIN_SELECT_KEY, PLANET_PIN_TELEPORT_KEY, PLANET_SELECT_KEY, PLANET_ZOOM_KEY, PLANET_DETAIL_KEY, PLANET_ZOOM_CHANGED_KEY, PLANET_MODE_KEY, PLANET_EMPTY_TAP_KEY, PLANET_SELECTED_MAP_KEY]) reg.set(k, undefined);
    this.planetHost.detach();
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
    const scene = this.planetHost.scene;
    scene?.setDebugGrid(this.gridOn);
  }

  /** Botón de la tarjeta: hace el zoom-in a la vista detalle del planeta */
  visitPlanet() {
    if (!this.selectedPlanet) return;
    const scene = this.planetHost.scene;
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

  /** Toque en una zona vacía del mapa (ni pin ni arrastre): deselecciona el mapa
   *  y se cierra su ficha de info. */
  deselectMap() {
    this.selectedMap = null;
    this.charsOnMap  = [];
  }

  private async loadCharsOnMap(mapId: string) {
    // Con el roster ya en memoria la ficha sale con su gente en el mismo frame
    if (this.roster) { this.charsOnMap = this.charsFrom(this.roster, m => m === mapId); return; }
    const list = await this.loadCharsWhere(m => m === mapId);
    if (this.selectedMap?.id === mapId) this.charsOnMap = list;   // ignora respuestas de un mapa anterior
  }

  /** Lee el roster y los snapshots de los demás personajes en paralelo (una vez por
   *  apertura del panel) y deja decodificados sus sprites de preview. */
  private ensureRoster(): Promise<RosterEntry[]> {
    if (this.rosterLoad) return this.rosterLoad;
    this.rosterLoad = (async () => {
      const chars   = ((await this.asgard.getCharacters()) ?? []).filter((c: any) => c?.id && c?.name);
      const current = String(this.asgard.selectedPlayer?.id ?? '');
      const roster = await Promise.all(chars.map(async (char: any): Promise<RosterEntry> => {
        const id = String(char.id);
        if (id === current) return { name: char.name, isCurrent: true, mapId: null, equipment: null };
        const snap = await this.storage.get(`snapshot_char_${id}`);
        return { name: char.name, isCurrent: false, mapId: snap?.mapId ?? null, equipment: snap?.equipment ?? {} };
      }));
      this.roster = roster;
      for (const r of roster) {
        prewarmCharacterSprite(r.name, r.equipment ? Object.values(r.equipment) : this.equipment.slots.map(s => s.item));
      }
      return roster;
    })();
    return this.rosterLoad;
  }

  private charsFrom(roster: RosterEntry[], matches: (mapId: string) => boolean): CharOnMap[] {
    return roster
      .filter(r => { const m = r.isCurrent ? this.currentMapId : r.mapId; return !!m && matches(m); })
      .map(r => ({ name: r.name, isCurrent: r.isCurrent, equipment: r.equipment }));
  }

  /** Recorre el roster y devuelve los personajes cuyo mapa cumple `matches`.
   *  El personaje activo usa `currentMapId` (reactivo, equipment null); el resto
   *  lee su snapshot persistido. Lo comparten la tarjeta de mapa y la de planeta. */
  private async loadCharsWhere(matches: (mapId: string) => boolean): Promise<CharOnMap[]> {
    return this.charsFrom(this.roster ?? await this.ensureRoster(), matches);
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
  get mapResources(): { labelKey: string; tier: number; img: string }[] {
    const m = this.selectedMap;
    if (!m || m.id === 'hogar') return [];
    const res = [
      { labelKey: 'MAP.RES_MINE', tier: m.mineTier ?? 1, img: this.harvestImg(miningTier(m.mineTier).rockTexture) },
      { labelKey: 'MAP.RES_TREE', tier: m.treeTier ?? 1, img: this.harvestImg(treeTier(m.treeTier).rockTexture) },
    ];
    const gem = gemTier(m.gemTier);
    if (gem) res.push({ labelKey: 'MAP.RES_GEM', tier: m.gemTier, img: this.harvestImg(gem.rockTexture) });
    return res;
  }

  // ── Ficha de info del mapa (pestañas Gente / Enemigos / Recursos) ───────────

  /** Pestaña abierta de la ficha; estática → se recuerda entre mapas y aperturas. */
  private static lastInfoTab: 'enemies' | 'resources' | 'people' = 'people';
  infoTab = WorldMapPanelComponent.lastInfoTab;
  setInfoTab(tab: 'enemies' | 'resources' | 'people') {
    this.infoTab = WorldMapPanelComponent.lastInfoTab = tab;
  }

  /** Tier del mapa (= nº de mapa: '1-3' → 3); null en el hogar. */
  get selectedTier(): number | null {
    return +(/^\d+-(\d+)$/.exec(this.selectedMap?.id ?? '')?.[1] ?? 0) || null;
  }

  /** Enemigos del mapa (solo el tipo base: élite/oblivion no se muestran). */
  get enemyRows(): { type: string; name: string }[] {
    return (this.selectedMap?.spawns ?? []).map(s => {
      const cfg = ENEMY_REGISTRY[s.enemyType];
      return { type: s.enemyType, name: cfg?.displayName ?? s.enemyType };
    });
  }

  /** Botín propio de los enemigos del mapa (items con icono; sin oro), sin repetir. */
  get mapDrops(): { name: string; icon: string }[] {
    const seen = new Map<string, string>();
    for (const r of this.enemyRows) {
      for (const e of LOOT_TABLES[r.type] ?? []) {
        if (e.type === 'item' && e.icon && !seen.has(e.name)) seen.set(e.name, e.icon);
      }
    }
    return [...seen].map(([name, icon]) => ({ name, icon }));
  }

  /** Dominio del mapa seleccionado (0..100), o null si el mapa no tiene (hogar). */
  get dominionPercent(): number | null {
    const id = this.selectedMap?.id;
    return id && this.dominion.hasDominion(id) ? this.dominion.state(id).percent : null;
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
