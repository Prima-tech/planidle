import { InteractionContext } from 'src/app/services/interaction.service';
import { GatheringSkillId } from 'src/app/services/gathering-skills.service';

// Recursos recolectables del mundo (rocas → pico, árboles → hacha). Config
// compartida entre la escena de juego (genera/golpea nodos) y el modelo de
// ganancias AFK (offline-gains), que estima recolección por hora.

export type HarvestKindId = 'rock' | 'tree';

export interface HarvestKind {
  texture: string;            // textura precargada del recurso
  toolCategory: string;       // categoría del item-herramienta requerido
  toolSlotId: string;         // slot de GatheringEquipment + slot de la capa LPC
  context: InteractionContext;// contexto del botón de acción ('mine' | 'chop')
  footprintW: number;         // ancho de la huella en tiles (colisión)
  footprintH: number;         // alto de la huella en tiles (colisión)
  scale: number;              // escala visual del sprite
  offsetY: number;            // ajuste vertical (px) para asentar la base en la huella
  count: number;              // cuántos generar por mapa
  debris: number[];           // colores de los escombros al golpear
  skill: GatheringSkillId;    // skill de recolección que progresa
  xp: number;                 // XP otorgada al recolectar (destruir) el nodo
  // Recurso soltado al destruir el nodo (nombre en ITEM_CATALOG). A futuro la
  // cantidad/probabilidad la escalarán talentos y variables de la skill.
  drop?: { name: string; min: number; max: number };
}

// Golpes necesarios para destruir (recolectar) un nodo.
export const HARVEST_HITS = 3;

// ── Tiers de minería ─────────────────────────────────────────────────────────
// Cada mapa minero define su tier (MapConfig.mineTier, default 1). El tier decide
// el sprite de la mena en el mundo, el item que suelta y el icono del minimapa.
export interface MiningTier {
  rockTexture: string;   // textura del sprite de la roca en el mundo (preload en gamescene)
  dropName:    string;   // item que suelta (nombre en ITEM_CATALOG)
  mmFrame:     number;   // frame del icono en el minimapa (Icons.png como spritesheet 16px)
}
export const MINING_TIERS: Record<number, MiningTier> = {
  1: { rockTexture: 'rock_tier1', dropName: 'Mineral Tier 1', mmFrame: 33 },   // Icons #2
  2: { rockTexture: 'rock_tier2', dropName: 'Mineral Tier 2', mmFrame: 30 },   // Icons #0
  3: { rockTexture: 'rock_tier3', dropName: 'Mineral Tier 3', mmFrame: 150 },  // Icons #40
  4: { rockTexture: 'rock_tier4', dropName: 'Mineral Tier 4', mmFrame: 273 },  // Icons #82
  5: { rockTexture: 'rock_tier5', dropName: 'Mineral Tier 5', mmFrame: 270 },  // Icons #80
  6: { rockTexture: 'rock_tier6', dropName: 'Mineral Tier 6', mmFrame: 390 },  // Icons #120
  7: { rockTexture: 'rock_tier7', dropName: 'Mineral Tier 7', mmFrame: 393 },  // Icons #122
  8: { rockTexture: 'rock_tier8', dropName: 'Mineral Tier 8', mmFrame: 153 },  // Icons #42
  9: { rockTexture: 'rock_tier9', dropName: 'Mineral Tier 9', mmFrame: 510 },  // Icons #160
  10:{ rockTexture: 'rock_tier10', dropName: 'Mineral Tier 10', mmFrame: 513 }, // Icons #162
};
export function miningTier(tier?: number): MiningTier {
  return MINING_TIERS[tier ?? 1] ?? MINING_TIERS[1];
}

// Config por tipo de recurso. Añadir aquí nuevos recolectables (caña→peces, etc.).
export const HARVEST_KINDS: Record<HarvestKindId, HarvestKind> = {
  rock: {
    texture: 'rock_tier1', toolCategory: 'Pico', toolSlotId: 'pickaxe', context: 'mine',
    footprintW: 2, footprintH: 2, scale: 3, offsetY: 0, count: 3,
    debris: [0x9a9a9a, 0x6f6f6f, 0xbdbdbd, 0x808080],
    skill: 'mining', xp: 1,   // XP base por piedra (1 tipo por ahora); modificadores futuros la escalan
    drop: { name: 'Mineral Tier 1', min: 1, max: 1 },   // suelta 1 mineral de tier 1 al minar
  },
  tree: {
    texture: 'tree_chop', toolCategory: 'Hacha', toolSlotId: 'axe', context: 'chop',
    footprintW: 2, footprintH: 2, scale: 3.2, offsetY: 80, count: 3,
    debris: [0x6b4a2b, 0x8a5a2b, 0x4e7a32, 0x3c6b28],   // madera + hojas
    skill: 'woodcutting', xp: 1,   // XP base por árbol; modificadores futuros la escalan
    drop: { name: 'Madera', min: 1, max: 1 },   // suelta 1 madera al talar
  },
};

/** Tipo de recurso asociado a una actividad de recolección. */
export function harvestKindForSkill(skill: GatheringSkillId): HarvestKindId {
  return skill === 'woodcutting' ? 'tree' : 'rock';
}
