import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Una línea de diálogo a mostrar en el cuadro de Angular. */
export interface DialogueLine {
  speaker: string;
  text: string;
}

/**
 * Diálogos de NPC. La escena Phaser llama a `show(speaker, text)` al hablar con un
 * NPC; el componente Angular (app-npc-dialogue) pinta el cuadro y lo cierra al tocar.
 */
@Injectable({ providedIn: 'root' })
export class DialogueService {
  readonly line$ = new BehaviorSubject<DialogueLine | null>(null);

  // Al abrir con un toque/clic, el navegador sintetiza un 'click' en el overlay al
  // soltar → cerraría el diálogo al instante. Ignoramos los cierres durante esta
  // ventana tras abrir para que no parpadee.
  private openedAt = 0;
  private static readonly DISMISS_GUARD_MS = 350;

  show(speaker: string, text: string): void {
    this.openedAt = Date.now();
    this.line$.next({ speaker, text });
  }

  dismiss(): void {
    if (!this.line$.value) return;
    if (Date.now() - this.openedAt < DialogueService.DISMISS_GUARD_MS) return;
    this.line$.next(null);
  }

  get isOpen(): boolean { return this.line$.value !== null; }
}
