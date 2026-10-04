import { Injectable, inject } from '@angular/core';
import { InventoryService } from './inventory.service';
import { UnlockService } from './unlock.service';
import { ITEM_CATALOG, hydrateItem } from '../physics/griddrops';

/** Receta de la mesa de trabajo: consume `cost` del inventario y da 1 `result`. */
export interface WorkbenchRecipe {
  id: string;
  /** Nombre (catálogo) del item que se fabrica. */
  result: string;
  cost: { name: string; qty: number }[];
  /** Flag que la desbloquea (UnlockService.hasFlag). Sin flag = disponible de serie. */
  unlockFlag?: string;
}

/** Pestaña de la mesa de trabajo según lo que fabrica la receta. */
export type WorkbenchKind = 'tool' | 'weapon' | 'armor';

/** Categoría del catálogo → pestaña. Lo que no esté aquí cae en herramientas. */
const KIND_BY_CATEGORY: Record<string, WorkbenchKind> = {
  Hacha: 'tool', Pico: 'tool',
  Arma: 'weapon',
  Armadura: 'armor', Casco: 'armor', Pantalones: 'armor', Botas: 'armor',
};

/** Flag que desbloquea la receta del pico de hierro (la dará una misión). */
export const RECIPE_IRON_PICKAXE_FLAG = 'recipe.iron_pickaxe';
/** Flag que desbloquea el arma y la pechera más básicas (misión noexp_armas). */
export const RECIPE_STARTER_GEAR_FLAG = 'recipe.starter_gear';

export const WORKBENCH_RECIPES: WorkbenchRecipe[] = [
  {
    id: 'iron_axe', result: 'Hacha de Hierro',
    cost: [{ name: 'Piedra', qty: 2 }, { name: 'Madera', qty: 2 }],
  },
  {
    id: 'iron_pickaxe', result: 'Pico de Hierro',
    cost: [{ name: 'Piedra', qty: 2 }, { name: 'Madera', qty: 2 }],
    unlockFlag: RECIPE_IRON_PICKAXE_FLAG,
  },
  {
    id: 'rusty_dagger', result: 'Daga Oxidada',
    cost: [{ name: 'Piedra', qty: 2 }, { name: 'Madera', qty: 2 }],
    unlockFlag: RECIPE_STARTER_GEAR_FLAG,
  },
  {
    id: 'ivory_armor', result: 'Coraza de Marfil',
    cost: [{ name: 'Piedra', qty: 2 }, { name: 'Madera', qty: 2 }],
    unlockFlag: RECIPE_STARTER_GEAR_FLAG,
  },
  // Resto del equipo básico (el primero de cada tipo del catálogo), con el mismo
  // desbloqueo que la coraza.
  {
    id: 'leather_greaves', result: 'Grebas de Cuero',
    cost: [{ name: 'Piedra', qty: 10 }, { name: 'Madera', qty: 10 }],
    unlockFlag: RECIPE_STARTER_GEAR_FLAG,
  },
  {
    id: 'iron_helm', result: 'Yelmo de Hierro',
    cost: [{ name: 'Piedra', qty: 10 }, { name: 'Madera', qty: 10 }],
    unlockFlag: RECIPE_STARTER_GEAR_FLAG,
  },
  {
    id: 'ivory_boots', result: 'Botas de Marfil',
    cost: [{ name: 'Piedra', qty: 10 }, { name: 'Madera', qty: 10 }],
    unlockFlag: RECIPE_STARTER_GEAR_FLAG,
  },
];

/** Lógica de la mesa de trabajo (recetas, coste y fabricación). La ventana es
 *  WorkbenchWindowComponent. Mismo patrón de cobro que PortalUnlockService. */
@Injectable({ providedIn: 'root' })
export class WorkbenchService {
  private inventory = inject(InventoryService);
  private unlocks = inject(UnlockService);

  readonly recipes = WORKBENCH_RECIPES;

  isUnlocked(r: WorkbenchRecipe): boolean {
    return !r.unlockFlag || this.unlocks.hasFlag(r.unlockFlag);
  }

  /** Icono del catálogo (aunque el jugador no tenga ninguno). */
  iconFor(name: string): string {
    return ITEM_CATALOG.find(e => e.name === name)?.icon ?? '';
  }

  /** Descripción del catálogo (para la ficha de la receta). */
  descFor(name: string): string {
    return ITEM_CATALOG.find(e => e.name === name)?.description ?? '';
  }

  have(name: string): number { return this.inventory.countByName(name); }

  /** Pestaña de la receta (herramientas / armas / armaduras), por la categoría de su resultado. */
  kindOf(r: WorkbenchRecipe): WorkbenchKind {
    const cat = ITEM_CATALOG.find(e => e.name === r.result)?.category ?? '';
    return KIND_BY_CATEGORY[cat] ?? 'tool';
  }

  canCraft(r: WorkbenchRecipe): boolean {
    return this.isUnlocked(r) && r.cost.every(c => this.have(c.name) >= c.qty);
  }

  /** Cobra el coste y añade el resultado (al suelo si el inventario está lleno). */
  craft(r: WorkbenchRecipe): boolean {
    if (!this.canCraft(r)) return false;
    const entry = ITEM_CATALOG.find(e => e.name === r.result);
    if (!entry) return false;
    for (const c of r.cost) this.inventory.consumeByName(c.name, c.qty);
    this.inventory.addOrDropToWorld(hydrateItem({ id: this.inventory.generateId(), name: entry.name }));
    return true;
  }
}
