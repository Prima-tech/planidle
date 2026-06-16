import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

/** Skills de recolección con progresión por nivel (XP al picar/talar). */
export type GatheringSkillId = 'mining' | 'woodcutting';

/** Metadatos para pintar la UI (orden = orden de sub-pestañas). */
export const GATHERING_SKILLS: { id: GatheringSkillId; labelKey: string; icon: string }[] = [
  { id: 'mining',      labelKey: 'GATHER_SKILLS.MINING',      icon: 'hammer-outline' },
  { id: 'woodcutting', labelKey: 'GATHER_SKILLS.WOODCUTTING', icon: 'cut-outline'    },
];

export const MAX_GATHER_LEVEL = 50;

/** XP acumulada + nº de recursos recolectados de una skill. */
export interface GatheringSkillState {
  xp: number;      // XP total acumulada
  gathered: number; // nodos recolectados (destruidos)
}

export type GatheringSkillsSnapshot = Record<GatheringSkillId, GatheringSkillState>;

/** Progreso resuelto para la UI. */
export interface GatheringSkillProgress {
  level: number;       // 1..MAX_GATHER_LEVEL
  intoLevel: number;   // XP dentro del nivel actual
  needed: number;      // XP para subir (0 si nivel máximo)
  ratio: number;       // 0..1 de la barra
  totalXp: number;     // XP acumulada total
  gathered: number;    // recursos recolectados
  max: boolean;        // nivel máximo alcanzado
}

function emptyState(): GatheringSkillsSnapshot {
  return {
    mining:      { xp: 0, gathered: 0 },
    woodcutting: { xp: 0, gathered: 0 },
  };
}

@Injectable({ providedIn: 'root' })
export class GatheringSkillsService {

  private state: GatheringSkillsSnapshot = emptyState();

  /** Emite el estado completo (para barras de XP en la ventana de equipo). */
  readonly skills$ = new BehaviorSubject<GatheringSkillsSnapshot>(emptyState());
  /** Emite al ganar XP de verdad (no durante restore). Útil para toasts/logros. */
  readonly gained$ = new Subject<{ skill: GatheringSkillId; xp: number }>();
  /** Cualquier cambio → dispara auto-save (igual que el resto de servicios per-char). */
  readonly changes$ = new Subject<void>();

  // --- Fórmula de XP ---

  /** XP necesaria para pasar de `level` al siguiente. */
  xpForLevel(level: number): number {
    return level * 100;
  }

  /** Resuelve nivel + progreso a partir de la XP acumulada. */
  private resolve(xp: number, gathered: number): GatheringSkillProgress {
    let level = 1;
    let remaining = xp;
    while (level < MAX_GATHER_LEVEL && remaining >= this.xpForLevel(level)) {
      remaining -= this.xpForLevel(level);
      level++;
    }
    const max = level >= MAX_GATHER_LEVEL;
    const needed = max ? 0 : this.xpForLevel(level);
    return {
      level,
      intoLevel: max ? 0 : remaining,
      needed,
      ratio: max ? 1 : (needed > 0 ? remaining / needed : 0),
      totalXp: xp,
      gathered,
      max,
    };
  }

  progress(skill: GatheringSkillId): GatheringSkillProgress {
    const s = this.state[skill];
    return this.resolve(s.xp, s.gathered);
  }

  // --- Registro de XP ---

  /** Suma XP a una skill (y cuenta el recurso recolectado). Lo llama la escena. */
  addXp(skill: GatheringSkillId, xp: number): void {
    if (xp <= 0) return;
    const s = this.state[skill];
    s.xp += xp;
    s.gathered += 1;
    this.skills$.next({ ...this.state });
    this.gained$.next({ skill, xp });
    this.changes$.next();
  }

  // --- Ciclo de vida (SaveService) ---

  restoreFromSnapshot(snap: GatheringSkillsSnapshot | null): void {
    const base = emptyState();
    if (snap) {
      for (const id of Object.keys(base) as GatheringSkillId[]) {
        if (snap[id]) base[id] = { xp: snap[id].xp ?? 0, gathered: snap[id].gathered ?? 0 };
      }
    }
    this.state = base;
    this.skills$.next({ ...this.state });
  }

  getSnapshot(): GatheringSkillsSnapshot {
    return {
      mining:      { ...this.state.mining },
      woodcutting: { ...this.state.woodcutting },
    };
  }

  clearAll(): void {
    this.state = emptyState();
    this.skills$.next({ ...this.state });
    this.changes$.next();
  }
}
