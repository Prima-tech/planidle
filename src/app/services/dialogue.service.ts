import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

/** Una línea de diálogo a mostrar en el cuadro de Angular. */
export interface DialogueLine {
  speaker: string;
  text: string;
  /** Hay otra línea después de esta → se muestra la flecha de continuar (▼). */
  hasNext: boolean;
}

/** Entrada del registro de chat (historial de líneas ya mostradas). */
export interface ChatEntry {
  id: number;
  speaker: string;
  text: string;
}

/**
 * Diálogos de NPC. La escena Phaser llama a `show(speaker, text)` al hablar con un
 * NPC; el componente Angular (app-npc-dialogue) pinta el cuadro. `text` puede ser
 * una línea o varias: se avanzan con `advance()` y solo la última oculta la flecha.
 * Se cierra al tocar el mapa, con el icono de finalizar o al alejarse del NPC.
 */
@Injectable({ providedIn: 'root' })
export class DialogueService {
  readonly line$ = new BehaviorSubject<DialogueLine | null>(null);
  /** Petición de "continuar" desde fuera (tecla espacio). El componente la trata
   *  igual que un toque en el cuadro: avanza de página, de línea, o cierra. */
  readonly next$ = new Subject<void>();

  /** Registro de chat: cada línea mostrada (NPC: texto) se acumula aquí para el
   *  componente de chat (app-chat-log). Cap a HISTORY_MAX (las más viejas caen). */
  readonly history$ = new BehaviorSubject<ChatEntry[]>([]);
  private static readonly HISTORY_MAX = 60;
  private _history: ChatEntry[] = [];
  private historyId = 0;

  private speaker = '';
  private lines: string[] = [];
  private index = 0;
  /** Diálogo abierto por código (recompensa de misión, etc.): NO se cierra al alejarte
   *  de un NPC — solo con toque / icono de cerrar. La escena respeta esta bandera. */
  private manual = false;
  get isManual(): boolean { return this.manual; }

  // Al abrir con un toque/clic, el navegador sintetiza un 'click' en el overlay al
  // soltar → cerraría/avanzaría el diálogo al instante. Ignoramos esos gestos durante
  // esta ventana tras abrir para que no parpadee.
  private openedAt = 0;
  private static readonly DISMISS_GUARD_MS = 350;

  show(speaker: string, text: string | string[], opts?: { manual?: boolean }): void {
    this.openedAt = Date.now();
    this.speaker = speaker;
    this.lines = Array.isArray(text) ? text.slice() : [text];
    this.index = 0;
    this.manual = !!opts?.manual;
    this.emit();
  }

  /** Avanza a la siguiente línea (si la hay). En la última no hace nada: se cierra con dismiss(). */
  advance(): void {
    if (!this.line$.value) return;
    if (Date.now() - this.openedAt < DialogueService.DISMISS_GUARD_MS) return;
    if (this.index < this.lines.length - 1) {
      this.index++;
      this.emit();
    }
  }

  /** Cierra el diálogo por completo (toque en el mapa, icono de finalizar, alejarse). */
  dismiss(): void {
    if (!this.line$.value) return;
    if (Date.now() - this.openedAt < DialogueService.DISMISS_GUARD_MS) return;
    this.lines = [];
    this.index = 0;
    this.manual = false;
    this.line$.next(null);
  }

  get isOpen(): boolean { return this.line$.value !== null; }

  /** Pide continuar (tecla espacio). Lo resuelve el componente (páginas/líneas/cierre). */
  requestNext(): void { if (this.line$.value) this.next$.next(); }

  /** Publica una línea SOLO en el registro de chat, sin abrir el bocadillo del NPC.
   *  Para la charla ambiental de otros personajes (AmbientChatService). */
  postChat(speaker: string, text: string): void {
    this.pushHistory(speaker, text);
  }

  private emit(): void {
    const speaker = this.speaker;
    const text = this.lines[this.index];
    this.line$.next({
      speaker,
      text,
      hasNext: this.index < this.lines.length - 1,
    });
    this.pushHistory(speaker, text);
  }

  /** Añade la línea al registro de chat (cap a HISTORY_MAX). */
  private pushHistory(speaker: string, text: string): void {
    this._history.push({ id: this.historyId++, speaker, text });
    if (this._history.length > DialogueService.HISTORY_MAX) this._history.shift();
    this.history$.next([...this._history]);
  }
}
