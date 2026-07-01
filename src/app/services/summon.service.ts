import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { LootEntry } from 'src/app/physics/griddrops';

@Injectable({ providedIn: 'root' })
export class SummonService {
  readonly request$    = new Subject<string>();
  readonly itemDrop$   = new Subject<LootEntry>();
  /** Emite el índice de cofre (0-8) para spawnear en el mapa. */
  readonly chestSpawn$    = new Subject<number>();
  /** Emite el ID del cofre de ciudad que el jugador acaba de abrir. Cada cofre
   *  tiene su propio almacén independiente identificado por este ID. */
  readonly townChestOpen$        = new Subject<string>();
  /** ID del cofre de ciudad cuya ventana está abierta (null = ninguna). */
  readonly townChestIsOpen$      = new BehaviorSubject<string | null>(null);
  /** Phaser pide a Angular que cierre la ventana del cofre (jugador se aleja). */
  readonly townChestCloseRequest$ = new Subject<void>();

  summon(enemyType: string): void {
    this.request$.next(enemyType);
  }

  dropItem(entry: LootEntry): void {
    this.itemDrop$.next(entry);
  }

  spawnChest(index: number): void {
    this.chestSpawn$.next(index);
  }
}
