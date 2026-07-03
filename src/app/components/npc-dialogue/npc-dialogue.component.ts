import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { DialogueService, DialogueLine } from 'src/app/services/dialogue.service';

/**
 * Cuadro de diálogo de NPC. Escucha DialogueService.line$ (lo dispara la escena
 * Phaser al hablar con un NPC) y muestra un bocadillo abajo-izquierda; se cierra al
 * tocar el mapa o al alejarse. Al cerrarse reproduce una animación de salida antes
 * de quitarse del DOM (por eso gestionamos `line`/`leaving` a mano en vez de un
 * *ngIf directo).
 *
 * Paginación: cada línea se corta en PÁGINAS de 2 líneas visuales (medidas con
 * canvas al ancho real del cuadro). Si una frase ocupa más de 2 líneas, se muestra
 * la primera página con "…" y al pulsar el bocadillo continúa en la siguiente; al
 * agotar las páginas de la línea, avanza a la siguiente línea (o cierra).
 */
@Component({
  selector: 'app-npc-dialogue',
  templateUrl: './npc-dialogue.component.html',
  styleUrls: ['./npc-dialogue.component.scss'],
  standalone: false,
})
export class NpcDialogueComponent implements OnInit, OnDestroy {
  private dialogue = inject(DialogueService);

  @ViewChild('dlgText') private dlgTextRef?: ElementRef<HTMLElement>;

  line: DialogueLine | null = null;
  leaving = false;

  /** Páginas (trozos de ≤2 líneas) de la línea actual y página visible. */
  pages: string[] = [];
  pageIndex = 0;

  /** Canvas compartido para medir el texto (word-wrap). */
  private static readonly measureCanvas = document.createElement('canvas');

  private static readonly LEAVE_MS = 180;
  /** Ventana tras abrir en la que se ignora el clic (el navegador sintetiza un
   *  'click' al soltar el toque de apertura → pasaría de página al instante). */
  private static readonly OPEN_GUARD_MS = 350;
  private showTime = 0;
  private sub?: Subscription;
  private leaveTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.sub = this.dialogue.line$.subscribe(line => {
      if (line) {
        clearTimeout(this.leaveTimer);
        this.leaving = false;
        const wasClosed = !this.line;
        this.line = line;
        this.pages = [];
        this.pageIndex = 0;
        if (wasClosed) this.showTime = Date.now();
        // El cuadro se pinta en este ciclo; medimos su ancho en el siguiente tick.
        setTimeout(() => this.paginate());
      } else if (this.line) {
        // Cierre: arranca la animación de salida y quita del DOM al acabar.
        this.leaving = true;
        clearTimeout(this.leaveTimer);
        this.leaveTimer = setTimeout(() => {
          this.line = null;
          this.leaving = false;
        }, NpcDialogueComponent.LEAVE_MS);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.leaveTimer);
  }

  /** Texto visible: la página actual, con "…" si la frase continúa. */
  get displayText(): string {
    const base = this.pages[this.pageIndex] ?? this.line?.text ?? '';
    return this.hasMorePages ? base + ' …' : base;
  }

  /** ¿Quedan más páginas de ESTA línea? */
  get hasMorePages(): boolean {
    return this.pageIndex < this.pages.length - 1;
  }

  /** Toque en el cuadro: continúa la frase (más páginas), avanza de línea, o cierra. */
  onBoxClick(): void {
    if (Date.now() - this.showTime < NpcDialogueComponent.OPEN_GUARD_MS) return;
    if (this.hasMorePages) { this.pageIndex++; return; }
    if (this.line?.hasNext) this.dialogue.advance();
    else this.dialogue.dismiss();
  }

  dismiss(): void { this.dialogue.dismiss(); }

  /** Corta `line.text` en páginas de 2 líneas visuales según el ancho real del cuadro. */
  private paginate(): void {
    const el = this.dlgTextRef?.nativeElement;
    if (!el || !this.line) return;
    const avail = el.clientWidth;
    if (avail <= 0) { setTimeout(() => this.paginate()); return; }   // aún sin layout

    const ctx = NpcDialogueComponent.measureCanvas.getContext('2d');
    if (!ctx) { this.pages = [this.line.text]; return; }
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

    // Reservamos hueco para el " …" al final de la línea, para que quepa sin cortar palabra.
    const lineMax = Math.max(10, avail - ctx.measureText('  …').width);

    const words = this.line.text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (!cur || ctx.measureText(test).width <= lineMax) cur = test;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);

    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2).join(' '));
    this.pages = pages.length ? pages : [this.line.text];
    this.pageIndex = 0;
  }
}
