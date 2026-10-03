import { Injectable, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { InventoryService } from './inventory.service';
import { PlayerStateService } from './player-state.service';
import { BUILDABLES, CityBuildService } from './city-build.service';
import { QuestService } from './quest.service';
import { KillService } from './kill.service';
import { ENEMY_REGISTRY } from '../enemy/enemy-config';

/** Pestañas de registro de la ventana de chat (la 3ª, la de diálogos, vive en DialogueService). */
export type LogChannel = 'loot' | 'combat';

/** Color de la línea: oro (oro/nivel), bueno (botín, bajas), malo (daño recibido),
 *  crítico, apagado (fallos/esquivas) o normal. */
export type LogTone = 'normal' | 'gold' | 'good' | 'bad' | 'crit' | 'muted';

export interface LogEntry {
  id: number;
  key: string;                       // clave i18n (LOG.*)
  params: Record<string, unknown>;
  /** Params que son a su vez claves i18n (p.ej. nombre de misión) → se traducen al pintar. */
  i18nParams?: string[];
  tone: LogTone;
  text: string;                      // ya traducido (se recalcula al cambiar de idioma)
  at: number;                        // Date.now() al crearla (para agrupar repeticiones)
}

const MAX: Record<LogChannel, number> = { loot: 80, combat: 120 };
/** Dos líneas iguales seguidas dentro de esta ventana se funden en una (×N). */
const MERGE_MS = 4000;
/** Las emisiones se agrupan: en combate hay varias líneas por segundo y cada emisión
 *  dispara detección de cambios en el chat. */
const FLUSH_MS = 150;

/**
 * Registros de la ventana de chat: "Progreso" (objetos y oro recogidos, recetas,
 * niveles, misiones) y "Combate" (golpes dados y recibidos, esquivas, bajas).
 *
 * Lo de Angular se escucha aquí (inventario, oro, nivel, recetas, misiones, bajas). Lo
 * de combate lo empuja la escena Phaser vía GameRegistry (`reg.gameLog`) con
 * `playerHit`/`playerHurt`/`playerAvoid`, FUERA de la zona de Angular: por eso
 * el componente reentra en NgZone al recibir.
 */
@Injectable({ providedIn: 'root' })
export class GameLogService implements OnDestroy {
  readonly loot$   = new BehaviorSubject<LogEntry[]>([]);
  readonly combat$ = new BehaviorSubject<LogEntry[]>([]);

  private lists: Record<LogChannel, LogEntry[]> = { loot: [], combat: [] };
  private dirty = new Set<LogChannel>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;
  private sub = new Subscription();

  constructor(
    private translate: TranslateService,
    inventory: InventoryService,
    playerState: PlayerStateService,
    cityBuild: CityBuildService,
    quests: QuestService,
    kills: KillService,
  ) {
    this.sub.add(inventory.itemDropped$.subscribe(it =>
      this.pushMerge('loot', 'LOG.ITEM', it.name, it.sum ?? 1, 'good')));
    this.sub.add(playerState.coinDropped$.subscribe(n => {
      if (n > 0) this.pushMerge('loot', 'LOG.GOLD', '', n, 'gold');
    }));
    this.sub.add(playerState.levelUp$.subscribe(lvl =>
      this.push('loot', 'LOG.LEVEL_UP', { lvl }, 'gold')));
    this.sub.add(cityBuild.learned$.subscribe(type => {
      const def = BUILDABLES.find(b => b.type === type);
      this.push('loot', 'LOG.RECIPE', { name: def?.name ?? type }, 'good', def ? ['name'] : undefined);
    }));
    this.sub.add(quests.completed$.subscribe(q =>
      this.push('loot', 'LOG.QUEST', { name: q.name }, 'gold', ['name'])));
    this.sub.add(kills.killDetail$.subscribe(({ enemyType }) =>
      this.push('combat', 'LOG.KILL', { enemy: enemyName(enemyType) }, 'good')));
    // Cambio de idioma: retraduce todo lo ya escrito.
    this.sub.add(this.translate.onLangChange.subscribe(() => {
      for (const ch of ['loot', 'combat'] as LogChannel[]) {
        for (const e of this.lists[ch]) e.text = this.render(e);
        this.markDirty(ch);
      }
    }));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }

  // ── API de combate (la llama la escena Phaser) ──────────────────────────────

  /** El jugador daña a un enemigo. `skill` = golpe de habilidad (no ataque básico). */
  playerHit(enemy: string, dmg: number, crit: boolean, skill = false): void {
    const key = skill ? (crit ? 'LOG.SKILL_CRIT' : 'LOG.SKILL_HIT') : (crit ? 'LOG.HIT_CRIT' : 'LOG.HIT');
    this.push('combat', key, { enemy, dmg }, crit ? 'crit' : 'normal');
  }

  /** Un enemigo daña al jugador. */
  playerHurt(enemy: string, dmg: number, crit: boolean): void {
    this.push('combat', crit ? 'LOG.HURT_CRIT' : 'LOG.HURT', { enemy: enemy || '?', dmg }, 'bad');
  }

  /** Ataque enemigo sin daño: esquiva (evasión), bloqueo (defensa ≥ daño) o fallo
   *  posicional (saliste del rango durante el wind-up). */
  playerAvoid(enemy: string, how: 'evade' | 'block' | 'miss'): void {
    const key = how === 'evade' ? 'LOG.EVADE' : how === 'block' ? 'LOG.BLOCK' : 'LOG.ENEMY_MISS';
    this.push('combat', key, { enemy: enemy || '?' }, 'muted');
  }

  clear(ch: LogChannel): void {
    this.lists[ch] = [];
    this.markDirty(ch);
  }

  // ── Interno ─────────────────────────────────────────────────────────────────

  private push(ch: LogChannel, key: string, params: Record<string, unknown>, tone: LogTone, i18nParams?: string[]): void {
    const e: LogEntry = { id: this.nextId++, key, params, i18nParams, tone, text: '', at: Date.now() };
    e.text = this.render(e);
    const list = this.lists[ch];
    list.push(e);
    if (list.length > MAX[ch]) list.splice(0, list.length - MAX[ch]);
    this.markDirty(ch);
  }

  /** Como push, pero si la última línea es el mismo objeto (o el oro), en vez de otra línea la
   *  suma: "Madera ×1" ×5 seguidas → "Madera ×5". */
  private pushMerge(ch: LogChannel, key: string, name: string, qty: number, tone: LogTone): void {
    const last = this.lists[ch][this.lists[ch].length - 1];
    if (last && last.key === key && last.params['name'] === name && Date.now() - last.at < MERGE_MS) {
      last.params['qty'] = (last.params['qty'] as number) + qty;
      last.at = Date.now();
      last.text = this.render(last);
      this.markDirty(ch);
      return;
    }
    this.push(ch, key, { name, qty }, tone);
  }

  private render(e: LogEntry): string {
    const p = { ...e.params };
    for (const k of e.i18nParams ?? []) p[k] = this.translate.instant(p[k] as string);
    return this.translate.instant(e.key, p);
  }

  private markDirty(ch: LogChannel): void {
    this.dirty.add(ch);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty.has('loot'))   this.loot$.next([...this.lists.loot]);
      if (this.dirty.has('combat')) this.combat$.next([...this.lists.combat]);
      this.dirty.clear();
    }, FLUSH_MS);
  }
}

/** Nombre visible de un tipo de enemigo (displayName del registro; si no, el tipo). */
export function enemyName(type: string): string {
  return ENEMY_REGISTRY[type]?.displayName ?? ENEMY_REGISTRY[type.replace(/_(elite|oblivion)$/, '')]?.displayName ?? type;
}
