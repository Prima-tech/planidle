import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { LootEntry } from 'src/app/physics/griddrops';

@Injectable({ providedIn: 'root' })
export class SummonService {
  readonly request$    = new Subject<string>();
  readonly itemDrop$   = new Subject<LootEntry>();
  /** Emite el índice de cofre (0-8) para spawnear en el mapa. */
  readonly chestSpawn$    = new Subject<number>();
  /** Emite cuando el jugador abre el cofre de ciudad fijo en Asgard. */
  readonly townChestOpen$        = new Subject<void>();
  /** true mientras la ventana del cofre de ciudad está abierta. */
  readonly townChestIsOpen$      = new BehaviorSubject<boolean>(false);
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
