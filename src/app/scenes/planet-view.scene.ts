import Phaser from 'phaser';

// Dos vistas en la misma escena:
//  - 'detail': un planeta (TileSprite + máscara circular) que gira al arrastrar,
//    con inercia. Botón «+» para hacer zoom-out al sistema.
//  - 'system': estrella central + planetas orbitando. Pulsar un planeta hace
//    zoom-in a su vista detalle.
// Las transiciones usan fade + tween de zoom de cámara.

const FRICTION   = 0.94;   // decaimiento de la inercia por frame
const MIN_VEL    = 0.02;   // umbral para frenar del todo
const DRAG_Y     = 0.5;    // el arrastre vertical pesa menos (sensación de eje)
const STAR_COUNT = 90;
const TEX_SIZE   = 512;
const SHADE_KEY  = 'planet_shade';

// El canvas se crea a resolución nativa (ver world-map-panel): toda medida en
// px fijos (fuentes, pins, botón) se multiplica por DPR para mantener el
// tamaño visual con texto nítido. Las medidas relativas a W/H escalan solas.
const DPR = Math.min(window.devicePixelRatio || 1, 3);

// Estilos pixel-art basados en los sprites de referencia (Downloads/Planets):
// terran (Terran.png), lava (Lava.png), ice (Ice.png), baren (Baren.png),
// blackhole (Black_hole.png). Para crear un planeta nuevo: copia una entrada,
// cambia id/name/colores/órbita y reutiliza el style que más se le parezca.
export type PixelStyle = 'terran' | 'lava' | 'ice' | 'baren' | 'blackhole';

interface PlanetDef {
  id: string;
  name: string;
  kind: 'blob' | 'bands' | 'pixel';
  style?: PixelStyle;    // solo para kind 'pixel'
  base: string;          // color de fondo (océano / corteza / hielo / vacío)
  features: string[];    // 3 colores según el style (ver cada generador)
  cloudAlpha: number;
  halo: number;          // color del borde de 1-2px en la vista detalle
  orbit: number;         // radio orbital (factor 0-1 sobre el máximo)
  size: number;          // radio en px en la vista sistema
  speed: number;         // velocidad orbital (rad/s)
}

const PLANETS: PlanetDef[] = [
  // terran: [tierra, tierra clara, arena] | lava: [resplandor, lava, lava brillante]
  // ice: [sombra suave, sombra fuerte, brillo] | baren: [cráter, sombra cráter, borde claro]
  // blackhole: [veta tenue, veta media, acento brillante]
  { id: 'mundo',   name: 'Tierra',  kind: 'pixel', style: 'terran',    base: '#2e62d0', features: ['#4ea33c', '#7ac855', '#e3d291'], cloudAlpha: 1, halo: 0x7fb4f0, orbit: 0.46, size: 22, speed: 0.10 },
  { id: 'magmar',  name: 'Magmar',  kind: 'pixel', style: 'lava',      base: '#1c0d08', features: ['#7a1e0e', '#e8502a', '#ffa040'], cloudAlpha: 0, halo: 0xff6a2e, orbit: 0.28, size: 15, speed: 0.16 },
  { id: 'ferrum',  name: 'Ferrum',  kind: 'pixel', style: 'baren',     base: '#8a98a8', features: ['#5a6874', '#46525e', '#aab6c2'], cloudAlpha: 0, halo: 0x9fb0c0, orbit: 0.63, size: 17, speed: 0.08 },
  { id: 'glacius', name: 'Glacius', kind: 'pixel', style: 'ice',       base: '#dde6f2', features: ['#b8c6dc', '#9fb2d0', '#ffffff'], cloudAlpha: 0, halo: 0xcfe0f8, orbit: 0.80, size: 19, speed: 0.06 },
  { id: 'vortex',  name: 'Vórtice', kind: 'pixel', style: 'blackhole', base: '#05030a', features: ['#1a1040', '#16275f', '#3a55f0'], cloudAlpha: 0, halo: 0x4a9af8, orbit: 0.97, size: 26, speed: 0.045 },
];

// Mapas del planeta Tierra, en ORDEN (Asgard primero). Posición FIJA sobre el globo
// vía tx/ty (coords de la textura, 0..TEX_SIZE=512): tx = horizontal (longitud),
// ty = vertical (latitud). Viven sobre la superficie y rotan con la textura.
// Ver buildWorldRoute / updatePins.
//
// PARA MOVER UN MAPA: cambia su tx/ty aquí y recarga. Consejos:
//  - ty entre ~150 y ~360 evita los polos (donde el globo deforma los pines).
//  - tx crecientes en orden → la ruta amarilla los une de Asgard a 1-8.
//  - solo se ve la cara delantera a la vez; para que varios salgan juntos,
//    mantenlos en una franja de tx de ~180px (el resto se ve girando el globo).
interface SurfacePin {
  name: string;
  mapId: string;
  color: number;
  tx: number;   // posición horizontal en la textura (0..511)
  ty: number;   // posición vertical en la textura (0..511)
}

const TIERRA_PINS: SurfacePin[] = [
  { name: 'Asgard', mapId: 'hogar', color: 0xf0c040, tx: 195, ty: 255 },
  { name: '1-1',   mapId: '1-1',   color: 0x5bc0f8, tx: 220, ty: 230 },
  { name: '1-2',   mapId: '1-2',   color: 0x5bc0f8, tx: 245, ty: 275 },
  { name: '1-3',   mapId: '1-3',   color: 0x5bc0f8, tx: 270, ty: 235 },
  { name: '1-4',   mapId: '1-4',   color: 0x5bc0f8, tx: 295, ty: 278 },
  { name: '1-5',   mapId: '1-5',   color: 0x5bc0f8, tx: 320, ty: 238 },
  { name: '1-6',   mapId: '1-6',   color: 0x5bc0f8, tx: 345, ty: 275 },
  { name: '1-7',   mapId: '1-7',   color: 0x5bc0f8, tx: 370, ty: 240 },
  { name: '1-8',   mapId: '1-8',   color: 0x5bc0f8, tx: 395, ty: 272 },
];

// El componente Angular registra aquí sus callbacks: abrir la tarjeta de info
// del mapa (click) y teletransportarse (doble click), como en la tab 0
export const PLANET_PIN_SELECT_KEY   = 'onPinSelect';
export const PLANET_PIN_TELEPORT_KEY = 'onPinTeleport';
// Click en un planeta de la vista sistema → tarjeta de info del planeta;
// doble click → zoom a la vista detalle (Angular solo cierra la tarjeta)
export const PLANET_SELECT_KEY       = 'onPlanetSelect';
export const PLANET_ZOOM_KEY         = 'onPlanetZoom';
// Predicado (mapId → bloqueado) que registra Angular: el globo lo usa para pintar
// los mapas bloqueados en gris y no extender la ruta hasta ellos.
export const PLANET_MAP_LOCKED_KEY    = 'isMapLocked';
// Callback () => string con el mapId donde está el jugador: al abrir el globo se
// orienta a ese mapa (o a la capital 'hogar' si no es un mapa válido del planeta).
export const PLANET_CURRENT_MAP_KEY   = 'planetCurrentMap';
// Callback (planetId) que la escena llama al construir una vista detalle: Angular lo
// usa para saber qué planeta se está viendo y mostrar su lista de mapas a la izquierda.
export const PLANET_DETAIL_KEY        = 'onPlanetDetail';

const DOUBLE_CLICK_MS = 300;

interface OrbitingPlanet {
  def: PlanetDef;
  img: Phaser.GameObjects.Image;
  angle: number;
  radiusX: number;
  radiusY: number;
}

// ── Constelación: Osa Mayor ──────────────────────────────────────────────────
// Posiciones normalizadas (0-1 sobre W/H) emulando el asterismo: cazo a la
// derecha (Dubhe-Merak-Phecda-Megrez) y mango descendiendo a la izquierda.
interface StarDef {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;    // radio en px (se multiplica por DPR)
  color: number;
  home?: boolean;  // la estrella de nuestro sistema
}

const CONSTELLATION: StarDef[] = [
  { id: 'dubhe',  name: 'Dubhe',  x: 0.81, y: 0.14, size: 9,   color: 0xffd9a0 },
  { id: 'merak',  name: 'Merak',  x: 0.76, y: 0.50, size: 8,   color: 0xcfe0ff },
  { id: 'phecda', name: 'Phecda', x: 0.57, y: 0.58, size: 7.5, color: 0xcfe0ff },
  { id: 'megrez', name: 'Megrez', x: 0.60, y: 0.22, size: 7,   color: 0xe8f0ff },
  { id: 'alioth', name: 'Alioth', x: 0.44, y: 0.32, size: 11,  color: 0xffdf90, home: true },
  { id: 'mizar',  name: 'Mizar',  x: 0.29, y: 0.48, size: 8.5, color: 0xd8e8ff },
  { id: 'alkaid', name: 'Alkaid', x: 0.12, y: 0.70, size: 8,   color: 0xcfe0ff },
];

// Trazo del asterismo: mango → cazo cerrado
const CONSTELLATION_LINES: [string, string][] = [
  ['alkaid', 'mizar'], ['mizar', 'alioth'], ['alioth', 'megrez'],
  ['megrez', 'dubhe'], ['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'],
];

type ViewMode = 'detail' | 'system' | 'constellation' | 'galaxy';

// ── Generación aleatoria de sistemas ─────────────────────────────────────────
// Cada estrella (salvo la home, que usa PLANETS) genera 4-8 planetas al
// visitarla por primera vez. Paletas predefinidas por estilo para que
// cualquier combinación aleatoria quede bien.
interface PlanetPalette {
  base: string;
  features: string[];
  halo: number;
}

const RANDOM_PALETTES: Record<Exclude<PixelStyle, 'blackhole'>, PlanetPalette[]> = {
  terran: [
    { base: '#2e62d0', features: ['#4ea33c', '#7ac855', '#e3d291'], halo: 0x7fb4f0 },  // terrestre
    { base: '#1f7a6a', features: ['#7a5c2e', '#a07c3e', '#d8c890'], halo: 0x6fd0c0 },  // océano verde
    { base: '#3a2e7a', features: ['#7a3ea0', '#a05cc8', '#d0a8e8'], halo: 0xb08ae8 },  // alienígena
  ],
  lava: [
    { base: '#1c0d08', features: ['#7a1e0e', '#e8502a', '#ffa040'], halo: 0xff6a2e },  // volcánico
    { base: '#140818', features: ['#5a0e7a', '#b02ae8', '#e878ff'], halo: 0xd05aff },  // plasma
    { base: '#0d1208', features: ['#1e5a0e', '#4ae82a', '#b8ff60'], halo: 0x6aff2e },  // tóxico
  ],
  ice: [
    { base: '#dde6f2', features: ['#b8c6dc', '#9fb2d0', '#ffffff'], halo: 0xcfe0f8 },  // glacial
    { base: '#cfeaea', features: ['#9fd0cc', '#7ab8b4', '#ffffff'], halo: 0xa0e8e0 },  // menta
    { base: '#e8dff2', features: ['#c8b8dc', '#b09fd0', '#ffffff'], halo: 0xd8c8f0 },  // lavanda
  ],
  baren: [
    { base: '#8a98a8', features: ['#5a6874', '#46525e', '#aab6c2'], halo: 0x9fb0c0 },  // gris
    { base: '#a89078', features: ['#74604a', '#5e4c3a', '#c2ac92'], halo: 0xc0a888 },  // desértico
    { base: '#987878', features: ['#684a4a', '#523a3a', '#b29292'], halo: 0xb89090 },  // rojizo
  ],
};

const NAME_SYL_A = ['Zor', 'Kel', 'Vor', 'Tau', 'Nyx', 'Ael', 'Dra', 'Mor', 'Sil', 'Quo', 'Ery', 'Tha'];
const NAME_SYL_B = ['va', 'ren', 'thar', 'mis', 'dun', 'lex', 'ria', 'gon', 'dor', 'bel'];
const NAME_SYL_C = ['', 'os', 'a', 'ix', 'um', 'ar', 'e', 'is'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generatePlanets(starId: string): PlanetDef[] {
  const count = Phaser.Math.Between(4, 8);
  const styles = Object.keys(RANDOM_PALETTES) as (keyof typeof RANDOM_PALETTES)[];
  const planets: PlanetDef[] = [];

  for (let i = 0; i < count; i++) {
    const style   = pick(styles);
    const palette = pick(RANDOM_PALETTES[style]);
    // Órbitas repartidas de dentro a fuera con algo de variación
    const orbit = 0.25 + (i / Math.max(1, count - 1)) * 0.70 + Phaser.Math.FloatBetween(-0.03, 0.03);
    planets.push({
      id: `${starId}_p${i}`,
      name: pick(NAME_SYL_A) + pick(NAME_SYL_B) + pick(NAME_SYL_C),
      kind: 'pixel',
      style,
      base: palette.base,
      features: [...palette.features],
      cloudAlpha: 0,
      halo: palette.halo,
      orbit,
      size: Phaser.Math.Between(8, 15),
      speed: 0.05 + (1 - orbit) * 0.12 + Phaser.Math.FloatBetween(0, 0.03),
    });
  }
  return planets;
}

export class PlanetViewScene extends Phaser.Scene {

  private mode: ViewMode = 'detail';
  private transitioning = false;

  // Vista detalle
  private detailC: Phaser.GameObjects.Container | null = null;
  private planet: Phaser.GameObjects.TileSprite | null = null;
  private planetMask: Phaser.GameObjects.Graphics | null = null;
  private detailCX = 0;
  private detailCY = 0;
  private detailR  = 0;
  // Pines de la Tierra: viven en coords de textura (tx/ty) y se proyectan cada frame
  // siguiendo el giro del globo (ver updatePins). Repartidos por la cara (zig-zag).
  private pinObjs: {
    dot: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
    tx: number; ty: number;
    locked: boolean;
    mapId: string;
  }[] = [];
  private routeGfx: Phaser.GameObjects.Graphics | null = null;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private velX = 0;
  private velY = 0;

  // Vista sistema — una por estrella; los sistemas generados se cachean por sesión
  private systemC: Phaser.GameObjects.Container | null = null;
  private orbiting: OrbitingPlanet[] = [];
  private currentStar!: StarDef;
  private readonly systemPlanets = new Map<string, PlanetDef[]>();

  // Vista constelación
  private constellationC: Phaser.GameObjects.Container | null = null;

  // Vista galaxia
  private galaxyC: Phaser.GameObjects.Container | null = null;

  constructor() { super({ key: 'PlanetViewScene' }); }

  create(): void {
    this.cameras.main.setBackgroundColor('#05060f');
    this.createStars(this.scale.width, this.scale.height);
    this.createShadeTexture();

    // La estrella home usa los planetas hechos a mano; el resto se generan al visitarlas
    this.currentStar = CONSTELLATION.find(s => s.home)!;
    this.systemPlanets.set(this.currentStar.id, PLANETS);

    this.buildGalaxyView();
    this.galaxyC!.setVisible(false);
    this.buildConstellationView();
    this.constellationC!.setVisible(false);
    this.buildSystemView();
    this.systemC!.setVisible(false);
    this.buildDetailView(PLANETS[0]);
    this.initDrag();
  }

  // Planetas de una estrella: genera (y crea texturas) la primera vez, luego caché
  private planetsFor(star: StarDef): PlanetDef[] {
    let planets = this.systemPlanets.get(star.id);
    if (!planets) {
      planets = generatePlanets(star.id);
      this.systemPlanets.set(star.id, planets);
    }
    for (const def of planets) {
      this.createPlanetTexture(def);
      this.createMiniTexture(def);
    }
    return planets;
  }

  override update(_t: number, delta: number): void {
    if (this.mode === 'detail') {
      this.updateInertia();
      this.updatePins();   // los pines y la ruta siguen el giro del globo
    } else if (this.mode === 'system') {
      this.updateOrbits(delta);
    }
    // 'constellation' es estática (los brillos van por tweens)
  }

  /** Llamado desde Angular (botón de la tarjeta de info del planeta) */
  zoomToPlanet(planetId: string): void {
    const planets = this.systemPlanets.get(this.currentStar.id) ?? [];
    const def = planets.find(p => p.id === planetId);
    if (def) this.goToPlanet(def);
  }

  // ── Transiciones ────────────────────────────────────────────────────────────

  /** Sin argumento vuelve al sistema actual; con estrella, entra en el suyo */
  private goToSystem(star?: StarDef): void {
    if (this.transitioning || this.mode === 'system') return;
    // Desde el detalle es zoom-out; desde la constelación es zoom-in
    const zoomIn = this.mode === 'constellation';
    this.transition(() => {
      this.detailC?.setVisible(false);
      this.constellationC?.setVisible(false);
      if (star && star.id !== this.currentStar.id) {
        this.currentStar = star;
        this.buildSystemView();  // reconstruye con los planetas de esa estrella
      }
      this.systemC?.setVisible(true);
      this.mode = 'system';
      this.notifyDetail('');   // ya no estamos en el globo → ocultar lista de mapas
    }, zoomIn);
  }

  private goToConstellation(): void {
    if (this.transitioning || this.mode === 'constellation' || this.mode === 'detail') return;
    // Cierra la tarjeta de info del planeta si estaba abierta en Angular
    const onZoom = this.game.registry.get(PLANET_ZOOM_KEY) as (() => void) | undefined;
    onZoom?.();
    // Desde el sistema es zoom-out; desde la galaxia es zoom-in
    const zoomIn = this.mode === 'galaxy';
    this.transition(() => {
      this.systemC?.setVisible(false);
      this.galaxyC?.setVisible(false);
      this.constellationC?.setVisible(true);
      this.mode = 'constellation';
    }, zoomIn);
  }

  private goToGalaxy(): void {
    if (this.transitioning || this.mode !== 'constellation') return;
    this.transition(() => {
      this.constellationC?.setVisible(false);
      this.galaxyC?.setVisible(true);
      this.mode = 'galaxy';
    }, /* zoomIn */ false);
  }

  private goToPlanet(def: PlanetDef): void {
    if (this.transitioning || this.mode !== 'system') return;
    this.transition(() => {
      this.systemC?.setVisible(false);
      this.buildDetailView(def);
      this.mode = 'detail';
    }, /* zoomIn */ true);
  }

  private transition(swap: () => void, zoomIn: boolean): void {
    this.transitioning = true;
    const cam = this.cameras.main;
    cam.fadeOut(160, 5, 6, 15);
    this.tweens.add({ targets: cam, zoom: zoomIn ? 1.3 : 0.75, duration: 160, ease: 'Sine.easeIn' });
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      swap();
      cam.zoom = zoomIn ? 0.8 : 1.25;
      this.tweens.add({
        targets: cam, zoom: 1, duration: 280, ease: 'Sine.easeOut',
        onComplete: () => { this.transitioning = false; },
      });
      cam.fadeIn(200, 5, 6, 15);
    });
  }

  // ── Vista detalle ───────────────────────────────────────────────────────────

  private buildDetailView(def: PlanetDef): void {
    this.detailC?.destroy(true);
    this.planetMask?.destroy();
    this.velX = 0;
    this.velY = 0;
    this.dragging = false;

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.34;

    this.detailC = this.add.container(0, 0);

    const edge = this.add.circle(cx, cy, radius + DPR, 0x000000, 0)
      .setStrokeStyle(2 * DPR, def.halo, 0.6);

    this.planet = this.add.tileSprite(cx, cy, radius * 2, radius * 2, this.texKey(def));
    this.planet.setTileScale(DPR);  // misma escala visual de la superficie que a DPR 1
    this.planetMask = this.make.graphics({}, false);
    this.planetMask.fillCircle(cx, cy, radius);
    this.planet.setMask(this.planetMask.createGeometryMask());

    const shade = this.add.image(cx, cy, SHADE_KEY);
    shade.setDisplaySize(radius * 2, radius * 2);

    // El nombre del planeta ya no se pinta en Phaser: lo muestra Angular (overlay)
    // a partir del callback notifyDetail(def.id, def.name).
    this.detailC.add([edge, this.planet, shade]);

    this.detailCX = cx;
    this.detailCY = cy;
    this.detailR  = radius;
    // detailC.destroy(true) ya destruyó los pines/ruta previos; soltamos sus refs
    // (otros planetas no tienen ruta, así que updatePins debe quedar inerte).
    this.pinObjs = [];
    this.routeGfx = null;
    if (def.id === 'mundo') this.buildWorldRoute();

    this.detailC.add(this.buildPlusButton(() => this.goToSystem()));

    // Avisar a Angular qué planeta se está viendo (lista de mapas a la izda. + nombre).
    this.notifyDetail(def.id, def.name);
  }

  /** Notifica a Angular el planeta en vista detalle ('' = ya no estamos en el globo,
   *  p.ej. al alejarse al sistema) para que muestre/oculte la lista de mapas y el nombre. */
  private notifyDetail(planetId: string, name = ''): void {
    const onDetail = this.game.registry.get(PLANET_DETAIL_KEY) as ((id: string, name: string) => void) | undefined;
    onDetail?.(planetId, name);
  }

  /**
   * Mapas de la Tierra en posición FIJA sobre el globo (tx/ty de cada pin en
   * TIERRA_PINS). Viven en coords de textura y rotan con el globo; updatePins los
   * proyecta y traza la fina línea amarilla que une los mapas DESBLOQUEADOS
   * consecutivos cercanos. Los bloqueados van en gris.
   */
  private buildWorldRoute(): void {
    if (!this.detailC) return;
    const lockFn = this.game.registry.get(PLANET_MAP_LOCKED_KEY) as ((id: string) => boolean) | undefined;
    const isLocked = (id: string) => !!lockFn && lockFn(id);

    const dotR = 5.5 * DPR;

    this.pinObjs = [];
    // La línea de ruta se redibuja cada frame (va detrás de los nodos).
    this.routeGfx = this.add.graphics();
    this.detailC.add(this.routeGfx);

    TIERRA_PINS.forEach((pin) => {
      const { tx, ty } = pin;
      const locked = isLocked(pin.mapId);

      const dot = this.add.circle(0, 0, dotR, locked ? 0x6b6357 : pin.color, 1)
        .setStrokeStyle(1.5 * DPR, 0x000000, 0.6);

      if (!locked) {
        // Centro local del Arc en (dotR, dotR); área de toque generosa.
        dot.setInteractive(new Phaser.Geom.Circle(dotR, dotR, 16 * DPR), Phaser.Geom.Circle.Contains);
        let lastClick = 0;
        dot.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();  // que no arranque el drag del planeta
          const now = Date.now();
          if (now - lastClick < DOUBLE_CLICK_MS) {
            const onTeleport = this.game.registry.get(PLANET_PIN_TELEPORT_KEY) as ((mapId: string) => void) | undefined;
            onTeleport?.(pin.mapId);
          } else {
            const onPin = this.game.registry.get(PLANET_PIN_SELECT_KEY) as ((mapId: string) => void) | undefined;
            onPin?.(pin.mapId);
          }
          lastClick = now;
        });
      }

      const label = this.add.text(0, 0, pin.name, {
        fontSize: `${13 * DPR}px`,
        color: locked ? '#8a8275' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4 * DPR,
      }).setOrigin(0, 0.5);

      this.detailC!.add([dot, label]);
      this.pinObjs.push({ dot, label, tx, ty, locked, mapId: pin.mapId });
    });

    this.updatePins();

    // Orientar el globo al mapa donde está el jugador (o a la capital 'hogar' si no
    // es un mapa válido del planeta). Sin animación: es el estado de apertura.
    const getMap = this.game.registry.get(PLANET_CURRENT_MAP_KEY) as (() => string) | undefined;
    this.focusMap(getMap?.() ?? '', false);
  }

  /** Gira el globo para centrar el pin del mapa dado en la cara visible (o la capital
   *  'hogar' si ese mapa no existe en este planeta). `animate` = giro suave; si no, lo
   *  coloca al instante (apertura). Solo aplica en la vista detalle con pines. */
  focusMap(mapId: string, animate = true): void {
    if (!this.planet || this.pinObjs.length === 0) return;
    const pin = this.pinObjs.find(p => p.mapId === mapId)
             ?? this.pinObjs.find(p => p.mapId === 'hogar')
             ?? this.pinObjs[0];
    if (!pin) return;

    // Centrar el pin: en updatePins, px = detailCX cuando Wrap(tx - tilePositionX) =
    // detailR/DPR. Despejamos tilePosition para esa condición (y lo mismo en Y).
    const off = this.detailR / DPR;
    const targetX = Phaser.Math.Wrap(pin.tx - off, 0, TEX_SIZE);
    const targetY = Phaser.Math.Wrap(pin.ty - off, 0, TEX_SIZE);

    // Cortar inercia/arrastre para que el giro no pelee con el dedo.
    this.dragging = false;
    this.velX = 0;
    this.velY = 0;
    this.tweens.killTweensOf(this.planet);

    if (!animate) {
      this.planet.tilePositionX = targetX;
      this.planet.tilePositionY = targetY;
      this.updatePins();
      return;
    }

    // Camino más corto respetando la costura (la textura envuelve cada TEX_SIZE px).
    const shortest = (from: number, to: number): number => {
      let d = (to - from) % TEX_SIZE;
      if (d >  TEX_SIZE / 2) d -= TEX_SIZE;
      if (d < -TEX_SIZE / 2) d += TEX_SIZE;
      return from + d;
    };
    this.tweens.add({
      targets: this.planet,
      tilePositionX: shortest(this.planet.tilePositionX, targetX),
      tilePositionY: shortest(this.planet.tilePositionY, targetY),
      duration: 700,
      ease: 'Cubic.easeInOut',
    });
  }

  // Proyecta cada pin desde coords de textura a pantalla siguiendo el scroll del
  // TileSprite (rota con el globo). Fuera de la cara visible se oculta (está "al otro
  // lado"); cerca del borde se encoge para simular la curvatura. Redibuja además la
  // línea amarilla uniendo los nodos consecutivos visibles y desbloqueados.
  private updatePins(): void {
    if (!this.planet || this.pinObjs.length === 0) return;
    const size = this.detailR * 2;
    const proj: { px: number; py: number; vis: boolean; locked: boolean }[] = [];

    for (const o of this.pinObjs) {
      const wx = Phaser.Math.Wrap(o.tx - this.planet.tilePositionX, 0, TEX_SIZE) * DPR;
      const wy = Phaser.Math.Wrap(o.ty - this.planet.tilePositionY, 0, TEX_SIZE) * DPR;
      const px = this.detailCX - this.detailR + wx;
      const py = this.detailCY - this.detailR + wy;
      const dx = (px - this.detailCX) / this.detailR;
      const dy = (py - this.detailCY) / this.detailR;
      const d2 = dx * dx + dy * dy;
      const vis = wx <= size && wy <= size && d2 <= 0.92;

      if (vis) {
        const curve = 0.7 + 0.3 * Math.sqrt(1 - d2);
        const alpha = (0.55 + 0.45 * (1 - d2)) * (o.locked ? 0.6 : 1);
        o.dot.setPosition(px, py).setScale(curve).setAlpha(alpha).setVisible(true);
        o.label.setPosition(px + 8 * DPR, py).setScale(curve).setAlpha(alpha).setVisible(true);
      } else {
        o.dot.setVisible(false);
        o.label.setVisible(false);
      }
      proj.push({ px, py, vis, locked: o.locked });
    }

    // Línea amarilla: une nodos consecutivos visibles y desbloqueados (ruta desde
    // Asgard). El maxGap evita trazar a través del globo cuando la textura envuelve.
    const g = this.routeGfx;
    if (g) {
      g.clear();
      g.lineStyle(1.5 * DPR, 0xf0c040, 0.9);
      const maxGap = size * 0.5;
      for (let i = 0; i < proj.length - 1; i++) {
        const a = proj[i], b = proj[i + 1];
        if (!a.vis || !b.vis || a.locked || b.locked) continue;
        if (Math.abs(a.px - b.px) > maxGap || Math.abs(a.py - b.py) > maxGap) continue;
        g.lineBetween(a.px, a.py, b.px, b.py);
      }
    }
  }

  // Botón «+» (esquina superior izquierda): zoom-out al siguiente nivel
  private buildPlusButton(onClick: () => void): Phaser.GameObjects.GameObject[] {
    const bx = 26 * DPR, by = 26 * DPR, r = 16 * DPR;
    const bg = this.add.circle(bx, by, r, 0x1e3a5f, 0.92).setStrokeStyle(1.5 * DPR, 0x3498db, 0.8);
    const label = this.add.text(bx, by - DPR, '+', {
      fontSize: `${22 * DPR}px`, color: '#5bc0f8', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();  // que no dispare el input de la vista de fondo
      onClick();
    });
    return [bg, label];
  }

  private initDrag(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.mode !== 'detail' || this.transitioning) return;
      if (this.planet) this.tweens.killTweensOf(this.planet);  // cancela el giro a un mapa
      this.dragging = true;
      this.lastX = p.x;
      this.lastY = p.y;
      this.velX = 0;
      this.velY = 0;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !this.planet) return;
      // /DPR: tilePosition va en px de textura y la textura se pinta a escala
      // DPR — así la superficie sigue exactamente al dedo
      const dx = (p.x - this.lastX) / DPR;
      const dy = ((p.y - this.lastY) * DRAG_Y) / DPR;
      this.lastX = p.x;
      this.lastY = p.y;
      this.planet.tilePositionX -= dx;
      this.planet.tilePositionY -= dy;
      this.velX = dx;
      this.velY = dy;
    });

    const stop = () => { this.dragging = false; };
    this.input.on('pointerup', stop);
    this.input.on('pointerupoutside', stop);
  }

  private updateInertia(): void {
    if (this.dragging || !this.planet) return;
    if (Math.abs(this.velX) < MIN_VEL && Math.abs(this.velY) < MIN_VEL) return;
    this.planet.tilePositionX -= this.velX;
    this.planet.tilePositionY -= this.velY;
    this.velX *= FRICTION;
    this.velY *= FRICTION;
  }

  // ── Vista sistema ───────────────────────────────────────────────────────────

  private buildSystemView(): void {
    // Se reconstruye al cambiar de estrella
    this.systemC?.destroy(true);

    const star    = this.currentStar;
    const planets = this.planetsFor(star);

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const maxOrbit = Math.min(W * 0.46, H * 0.78);

    this.systemC = this.add.container(0, 0);
    this.orbiting = [];

    // Órbitas (elipses aplastadas para dar perspectiva)
    const orbitGfx = this.add.graphics();
    orbitGfx.lineStyle(DPR, 0x3a5a8a, 0.25);
    for (const def of planets) {
      orbitGfx.strokeEllipse(cx, cy, def.orbit * maxOrbit * 2, def.orbit * maxOrbit * 2 * 0.42);
    }
    orbitGfx.setDepth(-5);
    this.systemC.add(orbitGfx);

    // Estrella central con pulso, en el color de la estrella de la constelación
    const sR = Math.min(W, H) * 0.085;
    const glow2 = this.add.circle(cx, cy, sR * 2.4, star.color, 0.07).setDepth(-1);
    const glow1 = this.add.circle(cx, cy, sR * 1.6, star.color, 0.16).setDepth(-0.9);
    const body  = this.add.circle(cx, cy, sR,       star.color, 1).setDepth(0);
    const core  = this.add.circle(cx, cy, sR * 0.6, 0xfff8f0, 1).setDepth(0.1);
    this.systemC.add([glow2, glow1, body, core]);

    // Nombre de la estrella
    const title = this.add.text(cx, 18 * DPR, star.name.toUpperCase(), {
      fontSize: `${13 * DPR}px`, color: '#7a9ac8', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5, 0.5).setAlpha(0.75).setDepth(10);
    this.systemC.add(title);
    this.tweens.add({
      targets: [glow1, glow2], alpha: 0.04, scaleX: 1.12, scaleY: 1.12,
      duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const hint = this.add.text(cx, H - 16 * DPR, 'Toca un planeta', {
      fontSize: `${11 * DPR}px`, color: '#6a8ab0', letterSpacing: 1,
    }).setOrigin(0.5, 0.5).setAlpha(0.7).setDepth(10);
    this.systemC.add(hint);

    const plusBtn = this.buildPlusButton(() => this.goToConstellation());
    plusBtn.forEach(o => (o as Phaser.GameObjects.Arc).setDepth?.(20));
    this.systemC.add(plusBtn);

    // Planetas
    for (const def of planets) {
      const img = this.add.image(0, 0, this.miniKey(def));
      img.setInteractive({ useHandCursor: true });
      let lastClick = 0;
      img.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        const now = Date.now();
        if (now - lastClick < DOUBLE_CLICK_MS) {
          // Doble click: zoom a la vista detalle del planeta. Angular cierra
          // la tarjeta que abrió el primer click.
          const onZoom = this.game.registry.get(PLANET_ZOOM_KEY) as (() => void) | undefined;
          onZoom?.();
          this.goToPlanet(def);
        } else {
          // Click: tarjeta de info en Angular (el zoom se hace desde el botón
          // de la tarjeta vía zoomToPlanet)
          const onSelect = this.game.registry.get(PLANET_SELECT_KEY) as ((id: string, name: string) => void) | undefined;
          onSelect?.(def.id, def.name);
        }
        lastClick = now;
      });
      img.on('pointerover', () => img.setScale(1.25));
      img.on('pointerout',  () => img.setScale(1));

      this.systemC.add(img);
      this.orbiting.push({
        def, img,
        angle:   Math.random() * Math.PI * 2,
        radiusX: def.orbit * maxOrbit,
        radiusY: def.orbit * maxOrbit * 0.42,
      });
    }
    this.positionOrbits();
  }

  private updateOrbits(delta: number): void {
    for (const o of this.orbiting) {
      o.angle += o.def.speed * (delta / 1000);
    }
    this.positionOrbits();
  }

  private positionOrbits(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    for (const o of this.orbiting) {
      o.img.setPosition(cx + Math.cos(o.angle) * o.radiusX, cy + Math.sin(o.angle) * o.radiusY);
      // Por detrás de la estrella en la mitad superior de la órbita
      o.img.setDepth(Math.sin(o.angle) > 0 ? 2 : -2);
    }
    // Los containers ignoran depth salvo que se ordene la lista explícitamente
    this.systemC?.sort('depth');
  }

  // ── Vista constelación (Osa Mayor) ──────────────────────────────────────────

  private buildConstellationView(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    this.constellationC = this.add.container(0, 0);

    // Líneas del asterismo
    const byId = new Map(CONSTELLATION.map(s => [s.id, s]));
    const lines = this.add.graphics();
    lines.lineStyle(DPR, 0x4a6a9a, 0.35);
    for (const [a, b] of CONSTELLATION_LINES) {
      const sa = byId.get(a)!;
      const sb = byId.get(b)!;
      lines.lineBetween(sa.x * W, sa.y * H, sb.x * W, sb.y * H);
    }
    this.constellationC.add(lines);

    // Estrellas
    for (const star of CONSTELLATION) {
      const sx = star.x * W;
      const sy = star.y * H;
      const r  = star.size * DPR;

      const glow = this.add.circle(sx, sy, r * 2.4, star.color, star.home ? 0.20 : 0.10);
      const body = this.add.circle(sx, sy, r, star.color, 1);
      const core = this.add.circle(sx, sy, r * 0.5, 0xffffff, 1);
      this.constellationC.add([glow, body, core]);

      if (star.home) {
        // Anillo pulsante: marca nuestro sistema
        const ring = this.add.circle(sx, sy, r * 1.9, 0x000000, 0)
          .setStrokeStyle(1.5 * DPR, 0xf0c040, 0.8);
        this.constellationC.add(ring);
        this.tweens.add({
          targets: [ring, glow], scaleX: 1.25, scaleY: 1.25, alpha: 0.45,
          duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      } else {
        this.tweens.add({
          targets: body, alpha: 0.55,
          duration: Phaser.Math.Between(900, 2000),
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }

      const label = this.add.text(sx, sy + r + 16 * DPR, star.name, {
        fontSize: `${14 * DPR}px`,
        color: star.home ? '#f0c040' : '#cfe0f8',
        fontStyle: 'bold',
        letterSpacing: 1,
        stroke: '#000000',
        strokeThickness: 3 * DPR,
      }).setOrigin(0.5, 0.5);
      this.constellationC.add(label);

      // Área de toque generosa (centro local del Arc = (radius, radius))
      body.setInteractive(new Phaser.Geom.Circle(r, r, r + 16 * DPR), Phaser.Geom.Circle.Contains);
      body.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.goToSystem(star);
      });
    }

    // Título y hint
    const title = this.add.text(W / 2, 18 * DPR, 'OSA MAYOR', {
      fontSize: `${13 * DPR}px`, color: '#7a9ac8', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5, 0.5).setAlpha(0.75);
    const hint = this.add.text(W / 2, H - 16 * DPR, 'Toca una estrella', {
      fontSize: `${11 * DPR}px`, color: '#6a8ab0', letterSpacing: 1,
    }).setOrigin(0.5, 0.5).setAlpha(0.7);
    this.constellationC.add([title, hint]);

    this.constellationC.add(this.buildPlusButton(() => this.goToGalaxy()));
  }

  // ── Vista galaxia ───────────────────────────────────────────────────────────

  private buildGalaxyView(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.min(W, H) * 0.42;

    this.galaxyC = this.add.container(0, 0);

    // Brazos espirales: puntos a lo largo de espirales con achatamiento
    // vertical (perspectiva). Rotan muy despacio como sub-container.
    const arms = this.add.container(cx, cy);
    const ARM_COUNT = 3;
    for (let arm = 0; arm < ARM_COUNT; arm++) {
      const phase = (arm * Math.PI * 2) / ARM_COUNT;
      for (let i = 0; i < 130; i++) {
        const t     = i / 130;
        const angle = phase + t * 4.2 + Phaser.Math.FloatBetween(-0.18, 0.18);
        const r     = 10 * DPR + t * maxR + Phaser.Math.FloatBetween(-6, 6) * DPR;
        const px    = Math.cos(angle) * r;
        const py    = Math.sin(angle) * r * 0.62;
        const tone  = Math.random();
        const color = tone < 0.6 ? 0xffffff : tone < 0.85 ? 0xcfe0ff : 0xffd9a0;
        const dot = this.add.circle(
          px, py,
          Phaser.Math.FloatBetween(0.6, 1.8) * DPR,
          color,
          Phaser.Math.FloatBetween(0.9, 0.35) * (1 - t * 0.5),
        );
        arms.add(dot);
      }
    }
    this.galaxyC.add(arms);
    this.tweens.add({ targets: arms, rotation: Math.PI * 2, duration: 240_000, repeat: -1 });

    // Bulbo central
    const bulge3 = this.add.circle(cx, cy, maxR * 0.30, 0xffe8c0, 0.10);
    const bulge2 = this.add.circle(cx, cy, maxR * 0.18, 0xffe8c0, 0.25);
    const bulge1 = this.add.circle(cx, cy, maxR * 0.09, 0xfff4dc, 0.85);
    this.galaxyC.add([bulge3, bulge2, bulge1]);

    // Marcador de la Osa Mayor: vuelve a la constelación
    const mx = cx + maxR * 0.58;
    const my = cy - maxR * 0.30;
    const markerRing = this.add.circle(mx, my, 11 * DPR, 0x000000, 0)
      .setStrokeStyle(1.5 * DPR, 0xf0c040, 0.85);
    const markerDot = this.add.circle(mx, my, 3 * DPR, 0xf0c040, 1);
    this.tweens.add({
      targets: markerRing, scaleX: 1.35, scaleY: 1.35, alpha: 0.4,
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const markerLabel = this.add.text(mx, my + 24 * DPR, 'Osa Mayor', {
      fontSize: `${13 * DPR}px`, color: '#f0c040', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3 * DPR,
    }).setOrigin(0.5, 0.5);
    this.galaxyC.add([markerRing, markerDot, markerLabel]);

    markerDot.setInteractive({
      hitArea: new Phaser.Geom.Circle(3 * DPR, 3 * DPR, 25 * DPR),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });
    markerDot.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.goToConstellation();
    });

    // Título y hint
    const title = this.add.text(cx, 18 * DPR, 'VÍA LÁCTEA', {
      fontSize: `${13 * DPR}px`, color: '#7a9ac8', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5, 0.5).setAlpha(0.75);
    const hint = this.add.text(cx, H - 16 * DPR, 'Toca la constelación', {
      fontSize: `${11 * DPR}px`, color: '#6a8ab0', letterSpacing: 1,
    }).setOrigin(0.5, 0.5).setAlpha(0.7);
    this.galaxyC.add([title, hint]);
  }

  // ── Texturas procedurales ───────────────────────────────────────────────────

  private texKey(def: PlanetDef): string  { return `planet_surface_${def.id}`; }
  private miniKey(def: PlanetDef): string { return `planet_mini_${def.id}`; }

  private createStars(w: number, h: number): void {
    for (let i = 0; i < STAR_COUNT; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        Phaser.Math.FloatBetween(0.5, 1.6) * DPR,
        0xffffff,
        Phaser.Math.FloatBetween(0.25, 0.9),
      );
      star.setDepth(-10);
      if (Math.random() < 0.25) {
        this.tweens.add({
          targets: star, alpha: 0.1,
          duration: Phaser.Math.Between(800, 2200),
          yoyo: true, repeat: -1,
        });
      }
    }
  }

  private createPlanetTexture(def: PlanetDef): void {
    const key = this.texKey(def);
    if (this.textures.exists(key)) return;
    const canvas = this.textures.createCanvas(key, TEX_SIZE, TEX_SIZE)!;
    const ctx = canvas.context;

    ctx.fillStyle = def.base;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    if (def.kind === 'pixel') {
      this.drawPixelStyle(ctx, def);
      canvas.refresh();
      // Sin interpolación al escalar: mantiene los píxeles nítidos
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return;
    }

    if (def.kind === 'bands') {
      // Gigante gaseoso: bandas horizontales (la costura del tile cae en un
      // borde de banda, así que no se nota) + óvalos de turbulencia
      const bandCount = 16;
      const bandH = TEX_SIZE / bandCount;
      for (let i = 0; i < bandCount; i++) {
        ctx.fillStyle = def.features[i % def.features.length];
        ctx.fillRect(0, i * bandH, TEX_SIZE, bandH);
      }
      ctx.globalAlpha = 0.25;
      for (let n = 0; n < 30; n++) {
        const ny = Math.random() * TEX_SIZE;
        const nx = Math.random() * TEX_SIZE;
        const r  = 10 + Math.random() * 30;
        ctx.fillStyle = def.features[Math.floor(Math.random() * def.features.length)];
        for (const ox of [-TEX_SIZE, 0, TEX_SIZE]) {
          ctx.beginPath();
          ctx.ellipse(nx + ox, ny, r * 2.2, r * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else {
      // Continentes: blobs duplicados en ±TEX_SIZE para que tilee sin costuras
      for (let c = 0; c < 8; c++) {
        const originX = Math.random() * TEX_SIZE;
        const originY = Math.random() * TEX_SIZE;
        ctx.fillStyle = def.features[c % def.features.length];
        for (let b = 0; b < 14; b++) {
          const bx = originX + (Math.random() - 0.5) * 130;
          const by = originY + (Math.random() - 0.5) * 90;
          const r  = 12 + Math.random() * 34;
          for (const ox of [-TEX_SIZE, 0, TEX_SIZE]) {
            for (const oy of [-TEX_SIZE, 0, TEX_SIZE]) {
              ctx.beginPath();
              ctx.arc(bx + ox, by + oy, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    if (def.cloudAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${def.cloudAlpha})`;
      for (let n = 0; n < 22; n++) {
        const nx = Math.random() * TEX_SIZE;
        const ny = Math.random() * TEX_SIZE;
        const r  = 8 + Math.random() * 26;
        for (const ox of [-TEX_SIZE, 0, TEX_SIZE]) {
          for (const oy of [-TEX_SIZE, 0, TEX_SIZE]) {
            ctx.beginPath();
            ctx.ellipse(nx + ox, ny + oy, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    canvas.refresh();
  }

  // ── Generadores pixel-art ───────────────────────────────────────────────────
  // Todos dibujan a 256px y escalan ×2 sin suavizado (bloques de 2px). Cada
  // elemento se replica en ±LOW en ambos ejes para que la textura tilee.

  private drawPixelStyle(ctx: CanvasRenderingContext2D, def: PlanetDef): void {
    const LOW = 256;
    const off = document.createElement('canvas');
    off.width = LOW;
    off.height = LOW;
    const o = off.getContext('2d')!;

    const wrapCircle = (x: number, y: number, r: number) => {
      for (const ox of [-LOW, 0, LOW]) {
        for (const oy of [-LOW, 0, LOW]) {
          o.beginPath();
          o.arc(x + ox, y + oy, r, 0, Math.PI * 2);
          o.fill();
        }
      }
    };

    o.fillStyle = def.base;
    o.fillRect(0, 0, LOW, LOW);

    switch (def.style) {
      case 'lava':      this.styleLava(o, LOW, def, wrapCircle);  break;
      case 'ice':       this.styleIce(o, LOW, def, wrapCircle);   break;
      case 'baren':     this.styleBaren(o, LOW, def, wrapCircle); break;
      case 'blackhole': this.styleBlackhole(o, LOW, def);         break;
      default:          this.styleTerran(o, LOW, def, wrapCircle);
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, LOW, LOW, 0, 0, TEX_SIZE, TEX_SIZE);
  }

  // Ref Terran.png: océano vivo, continentes con costa de arena, nubes duras
  private styleTerran(o: CanvasRenderingContext2D, LOW: number, def: PlanetDef,
                      wrapCircle: (x: number, y: number, r: number) => void): void {
    const [land, landLight, sand] = def.features;

    o.fillStyle = 'rgba(10, 20, 90, 0.22)';
    for (let i = 0; i < 6; i++) {
      wrapCircle(Math.random() * LOW, Math.random() * LOW, 16 + Math.random() * 28);
    }

    // Continentes: dos pasadas (arena debajo → tierra encima) para la costa
    for (let c = 0; c < 5; c++) {
      const originX = Math.random() * LOW;
      const originY = Math.random() * LOW;
      const blobs: { x: number; y: number; r: number }[] = [];
      for (let b = 0; b < 10; b++) {
        blobs.push({
          x: originX + (Math.random() - 0.5) * 68,
          y: originY + (Math.random() - 0.5) * 48,
          r: 8 + Math.random() * 18,
        });
      }
      o.fillStyle = sand;
      for (const b of blobs) wrapCircle(b.x, b.y, b.r + 3.5);
      o.fillStyle = land;
      for (const b of blobs) wrapCircle(b.x, b.y, b.r);
      o.fillStyle = landLight;
      for (const b of blobs) {
        if (Math.random() < 0.5) wrapCircle(b.x, b.y, b.r * 0.45);
      }
    }

    // Nubes con sombra gris sutil
    for (let n = 0; n < 9; n++) {
      const cxn = Math.random() * LOW;
      const cyn = Math.random() * LOW;
      const parts = 2 + Math.floor(Math.random() * 3);
      for (let p = 0; p < parts; p++) {
        const px = cxn + (Math.random() - 0.5) * 28;
        const py = cyn + (Math.random() - 0.5) * 12;
        const rw = 6 + Math.random() * 12;
        for (const ox of [-LOW, 0, LOW]) {
          for (const oy of [-LOW, 0, LOW]) {
            o.fillStyle = 'rgba(200, 212, 226, 0.85)';
            o.beginPath();
            o.ellipse(px + ox, py + oy + 2, rw, rw * 0.45, 0, 0, Math.PI * 2);
            o.fill();
            o.fillStyle = '#f4f4f4';
            o.beginPath();
            o.ellipse(px + ox, py + oy, rw, rw * 0.45, 0, 0, Math.PI * 2);
            o.fill();
          }
        }
      }
    }
  }

  // Ref Lava.png: corteza oscura con ríos de lava en tres capas (resplandor →
  // lava → centro brillante) y algunos lagos
  private styleLava(o: CanvasRenderingContext2D, LOW: number, def: PlanetDef,
                    wrapCircle: (x: number, y: number, r: number) => void): void {
    const [glow, lava, bright] = def.features;

    o.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let i = 0; i < 8; i++) {
      wrapCircle(Math.random() * LOW, Math.random() * LOW, 14 + Math.random() * 30);
    }

    const drawPath = (pts: number[][], width: number, color: string) => {
      o.strokeStyle = color;
      o.lineWidth = width;
      o.lineCap = 'round';
      o.lineJoin = 'round';
      for (const ox of [-LOW, 0, LOW]) {
        for (const oy of [-LOW, 0, LOW]) {
          o.beginPath();
          o.moveTo(pts[0][0] + ox, pts[0][1] + oy);
          for (let i = 1; i < pts.length; i++) o.lineTo(pts[i][0] + ox, pts[i][1] + oy);
          o.stroke();
        }
      }
    };

    // Ríos de lava: random walks
    for (let r = 0; r < 7; r++) {
      const pts: number[][] = [];
      let x = Math.random() * LOW;
      let y = Math.random() * LOW;
      let ang = Math.random() * Math.PI * 2;
      for (let s = 0; s < 10; s++) {
        pts.push([x, y]);
        ang += (Math.random() - 0.5) * 1.2;
        x += Math.cos(ang) * (12 + Math.random() * 10);
        y += Math.sin(ang) * (12 + Math.random() * 10);
      }
      drawPath(pts, 9, glow);
      drawPath(pts, 5, lava);
      drawPath(pts, 2, bright);
    }

    // Lagos de lava
    for (let i = 0; i < 4; i++) {
      const x = Math.random() * LOW;
      const y = Math.random() * LOW;
      const r = 7 + Math.random() * 9;
      o.fillStyle = glow;
      wrapCircle(x, y, r + 3);
      o.fillStyle = lava;
      wrapCircle(x, y, r);
      o.fillStyle = bright;
      wrapCircle(x, y, r * 0.45);
    }
  }

  // Ref Ice.png: superficie pálida moteada con sombras suaves y brillos blancos
  private styleIce(o: CanvasRenderingContext2D, LOW: number, def: PlanetDef,
                   wrapCircle: (x: number, y: number, r: number) => void): void {
    const [shade1, shade2, white] = def.features;

    o.fillStyle = shade1;
    for (let i = 0; i < 11; i++) {
      wrapCircle(Math.random() * LOW, Math.random() * LOW, 12 + Math.random() * 24);
    }
    o.fillStyle = shade2;
    for (let i = 0; i < 8; i++) {
      wrapCircle(Math.random() * LOW, Math.random() * LOW, 6 + Math.random() * 14);
    }
    o.fillStyle = white;
    for (let i = 0; i < 14; i++) {
      wrapCircle(Math.random() * LOW, Math.random() * LOW, 3 + Math.random() * 8);
    }
  }

  // Ref Baren.png: roca gris con cráteres (borde claro arriba, fondo oscuro,
  // sombra interior desplazada)
  private styleBaren(o: CanvasRenderingContext2D, LOW: number, def: PlanetDef,
                     wrapCircle: (x: number, y: number, r: number) => void): void {
    const [crater, craterShadow, rim] = def.features;

    o.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let i = 0; i < 8; i++) {
      wrapCircle(Math.random() * LOW, Math.random() * LOW, 14 + Math.random() * 28);
    }

    for (let c = 0; c < 11; c++) {
      const x = Math.random() * LOW;
      const y = Math.random() * LOW;
      const r = 5 + Math.random() * 11;
      o.fillStyle = rim;
      wrapCircle(x, y - r * 0.18, r + 1.8);
      o.fillStyle = crater;
      wrapCircle(x, y, r);
      o.fillStyle = craterShadow;
      wrapCircle(x + r * 0.15, y + r * 0.22, r * 0.55);
    }
  }

  // Ref Black_hole.png: vacío negro con vetas horizontales onduladas del disco
  // de acreción (el anillo azul lo pone el borde con def.halo)
  private styleBlackhole(o: CanvasRenderingContext2D, LOW: number, def: PlanetDef): void {
    const [wisp1, wisp2, accent] = def.features;

    const band = (color: string, width: number, alpha: number, yBase: number, amp: number, phase: number) => {
      o.strokeStyle = color;
      o.globalAlpha = alpha;
      o.lineWidth = width;
      for (const oy of [-LOW, 0, LOW]) {
        o.beginPath();
        for (let x = -4; x <= LOW + 4; x += 4) {
          // 2 ciclos completos de seno → la onda empalma en el borde horizontal
          const y = yBase + oy + Math.sin((x / LOW) * Math.PI * 4 + phase) * amp;
          if (x === -4) o.moveTo(x, y); else o.lineTo(x, y);
        }
        o.stroke();
      }
    };

    for (let i = 0; i < 10; i++) {
      band(
        Math.random() < 0.5 ? wisp1 : wisp2,
        6 + Math.random() * 9,
        0.5,
        Math.random() * LOW,
        4 + Math.random() * 8,
        Math.random() * Math.PI * 2,
      );
    }
    for (let i = 0; i < 4; i++) {
      band(accent, 1.5 + Math.random() * 1.5, 0.8, Math.random() * LOW, 3 + Math.random() * 6, Math.random() * Math.PI * 2);
    }
    o.globalAlpha = 1;
  }

  // Versión mini pre-renderizada (recorte circular + sombreado) para la vista
  // sistema — evita una máscara por planeta
  private createMiniTexture(def: PlanetDef): void {
    const key = this.miniKey(def);
    if (this.textures.exists(key)) return;
    const d = def.size * 2 * DPR;  // resolución nativa para que no pixele
    const canvas = this.textures.createCanvas(key, d, d)!;
    const ctx = canvas.context;

    const src = this.textures.get(this.texKey(def)).getSourceImage() as HTMLCanvasElement;
    if (def.kind === 'pixel') ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, 220, 220, 0, 0, d, d);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    const grad = ctx.createRadialGradient(d * 0.36, d * 0.34, d * 0.05, d * 0.5, d * 0.5, d * 0.52);
    grad.addColorStop(0,   'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1,   'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2);
    ctx.fill();

    // El agujero negro necesita su anillo para verse sobre el fondo espacial
    if (def.style === 'blackhole') {
      ctx.strokeStyle = `#${def.halo.toString(16).padStart(6, '0')}`;
      ctx.lineWidth = Math.max(2, 1.5 * DPR);
      ctx.beginPath();
      ctx.arc(d / 2, d / 2, d / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    canvas.refresh();
  }

  // Luz arriba-izquierda + sombra en el limbo: el disco pasa a leerse como esfera
  private createShadeTexture(): void {
    if (this.textures.exists(SHADE_KEY)) return;
    const size = 256;
    const canvas = this.textures.createCanvas(SHADE_KEY, size, size)!;
    const ctx = canvas.context;

    const grad = ctx.createRadialGradient(
      size * 0.36, size * 0.34, size * 0.05,
      size * 0.5,  size * 0.5,  size * 0.52,
    );
    grad.addColorStop(0,    'rgba(255, 255, 255, 0.28)');
    grad.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.8,  'rgba(0, 0, 0, 0.38)');
    grad.addColorStop(1,    'rgba(0, 0, 0, 0.82)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    canvas.refresh();
  }
}
