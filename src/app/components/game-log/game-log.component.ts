import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { InventoryService } from 'src/app/services/inventory.service';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { RegenService } from 'src/app/services/regen.service';
import { RunProgressService } from 'src/app/services/run-progress.service';

interface LogEntry {
  id: number;
  name: string;          // clave de agrupación
  label: string;         // texto visible
  type: 'drop' | 'coin' | 'regen-hp' | 'regen-mp' | 'star';
  sum: number;           // cantidad acumulada
  mergeable: boolean;
  fading: boolean;
  bumped: boolean;
  timerId: ReturnType<typeof setTimeout>;
}

let nextId = 0;
const VISIBLE_MS   = 3000;
const EXTENDED_MS  = 1500; // tiempo extra al actualizar
const FADE_MS      = 400;

@Component({
  selector: 'app-game-log',
  templateUrl: './game-log.component.html',
  styleUrls: ['./game-log.component.scss'],
  standalone: false
})
export class GameLogComponent implements OnInit, OnDestroy {
  entries: LogEntry[] = [];
  private subs: Subscription[] = [];

  constructor(
    private inventoryService: InventoryService,
    private playerState: PlayerStateService,
    private translate: TranslateService,
    private regen: RegenService,
    private runProgress: RunProgressService,
  ) {}

  ngOnInit() {
    this.subs.push(
      this.inventoryService.itemDropped$.subscribe(item => {
        this.push({
          name:      item.name,
          label:     `+ ${item.name}`,
          type:      'drop',
          sum:       item.sum ?? 1,
          mergeable: item.mergeable ?? false,
        });
      }),
      this.playerState.coinDropped$.subscribe(amount => {
        this.push({
          name:      '__coins__',
          label:     `+ ${this.translate.instant('GAME_LOG.COINS')}`,
          type:      'coin',
          sum:       amount,
          mergeable: true,
        });
      }),
      this.regen.regenTick$.subscribe(({ hp, mp }) => {
        if (hp > 0) {
          this.push({ name: '__regen_hp__', label: `HP rec: +${hp}`, type: 'regen-hp', sum: hp, mergeable: true });
        }
        if (mp > 0) {
          this.push({ name: '__regen_mp__', label: `MP rec: +${mp}`, type: 'regen-mp', sum: mp, mergeable: true });
        }
      }),
      // Estrellas del Modo Exploración: cada recogida física suma a una sola línea.
      this.runProgress.starPicked$.subscribe(amount => {
        this.push({
          name:      '__stars__',
          label:     `+ ${this.translate.instant('GAME_LOG.STARS')}`,
          type:      'star',
          sum:       amount,
          mergeable: true,
        });
      }),
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  trackById(_: number, e: LogEntry) { return e.id; }

  private push(data: { name: string; label: string; type: LogEntry['type']; sum: number; mergeable: boolean }) {
    // Buscar entrada existente agrupable (mismo nombre, stackeable, no desapareciendo)
    const existing = data.mergeable
      ? this.entries.find(e => e.name === data.name && !e.fading)
      : null;

    if (existing) {
      existing.sum += data.sum;
      existing.label = this.buildLabel(data.label.split(' ').slice(1).join(' '), existing.sum, data.type);
      if (data.type !== 'star') this.bump(existing);   // estrellas: sin "flashazo" al acumular
      this.scheduleRemoval(existing, VISIBLE_MS + EXTENDED_MS);
    } else {
      const entry: LogEntry = {
        id:        nextId++,
        name:      data.name,
        label:     this.buildLabel(data.label.split(' ').slice(1).join(' '), data.sum, data.type),
        type:      data.type,
        sum:       data.sum,
        mergeable: data.mergeable,
        fading:    false,
        bumped:    false,
        timerId:   null,
      };
      this.entries.push(entry);
      this.scheduleRemoval(entry, VISIBLE_MS);
    }
  }

  private buildLabel(name: string, sum: number, type: LogEntry['type']): string {
    if (type === 'regen-hp') return `HP rec: +${sum}`;
    if (type === 'regen-mp') return `MP rec: +${sum}`;
    // Estrellas: solo icono + contador (sin la palabra "Estrellas").
    if (type === 'star') return `⭐ ×${sum}`;
    const prefix = type === 'coin' ? '🪙' : '+';
    return sum > 1 ? `${prefix} ${name} ×${sum}` : `${prefix} ${name}`;
  }

  private bump(entry: LogEntry) {
    entry.bumped = false;
    // Fuerza el reflow para reiniciar la animación CSS
    setTimeout(() => { entry.bumped = true; }, 10);
    setTimeout(() => { entry.bumped = false; }, 410);
  }

  private scheduleRemoval(entry: LogEntry, delay: number) {
    clearTimeout(entry.timerId);
    entry.fading = false;
    entry.timerId = setTimeout(() => {
      entry.fading = true;
      setTimeout(() => {
        this.entries = this.entries.filter(e => e.id !== entry.id);
      }, FADE_MS);
    }, delay);
  }
}
