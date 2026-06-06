import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { LootEntry } from 'src/app/physics/griddrops';

@Injectable({ providedIn: 'root' })
export class SummonService {
  readonly request$   = new Subject<string>();
  readonly itemDrop$  = new Subject<LootEntry>();

  summon(enemyType: string): void {
    this.request$.next(enemyType);
  }

  dropItem(entry: LootEntry): void {
    this.itemDrop$.next(entry);
  }
}
