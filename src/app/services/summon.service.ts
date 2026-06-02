import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SummonService {
  readonly request$ = new Subject<string>();

  summon(enemyType: string): void {
    this.request$.next(enemyType);
  }
}
