import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type InteractionContext = 'attack' | 'chest' | 'shop' | 'mine' | 'chop' | 'talk';

@Injectable({ providedIn: 'root' })
export class InteractionService {
  /** Contexto actual del botón de acción principal. */
  readonly context$ = new BehaviorSubject<InteractionContext>('attack');

  setContext(ctx: InteractionContext): void {
    if (this.context$.value !== ctx) this.context$.next(ctx);
  }

  get context(): InteractionContext { return this.context$.value; }
}
