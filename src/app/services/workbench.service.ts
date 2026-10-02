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

/** Flag que desbloquea la receta del pico de hierro (la dará una misión). */
export const RECIPE_IRON_PICKAXE_FLAG = 'recipe.iron_pickaxe';

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

  have(name: string): number { return this.inventory.countByName(name); }

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
