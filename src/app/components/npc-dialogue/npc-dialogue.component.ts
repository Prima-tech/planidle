import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { DialogueService, DialogueLine } from 'src/app/services/dialogue.service';
import { NPC_PORTRAITS } from 'src/app/services/quest.service';

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
  private zone = inject(NgZone);

  @ViewChild('dlgText') private dlgTextRef?: ElementRef<HTMLElement>;

  line: DialogueLine | null = null;
  leaving = false;

  /** Páginas (trozos de ≤2 líneas) de la línea actual y página visible. */
  pages: string[] = [];
  pageIndex = 0;

  private static readonly LEAVE_MS = 180;
  /** Ventana tras abrir en la que se ignora el clic (el navegador sintetiza un
   *  'click' al soltar el toque de apertura → pasaría de página al instante). */
  private static readonly OPEN_GUARD_MS = 350;
  private showTime = 0;
  private sub?: Subscription;
  private leaveTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // La escena Phaser corre FUERA de la zona de Angular, así que line$/next$ emiten
    // fuera de zona: hay que reentrar en NgZone para que el cambio se detecte, se
    // renderice el cuadro y `paginate()` (en el setTimeout) encuentre ya el DOM.
    // La tecla espacio (desde la escena Phaser) actúa igual que un toque en el cuadro.
    this.sub = this.dialogue.next$.subscribe(() => this.zone.run(() => this.onBoxClick()));
    this.sub.add(this.dialogue.line$.subscribe(line => this.zone.run(() => {
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
    })));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.leaveTimer);
  }

  /** Retrato del hablante: recorta la CABEZA de su frame idle en la hoja LPC (misma
   *  receta que el retrato del NPC en el panel de misiones) y la escala al avatar.
   *  `null` si el hablante no tiene entrada en NPC_PORTRAITS → el hueco se oculta. */
  // ── Mandos del encuadre del retrato (tócalos para ajustar a ojo) ──────────────
  private static readonly AV_PX = 46;       // lado del retrato (px)
  private static readonly LPC_FRAME = 64;   // lado del frame LPC
  private static readonly HEAD_X = 15;      // origen X de la cabeza dentro del frame (↑ = paneo a la derecha)
  private static readonly HEAD_Y = 10;      // origen Y de la cabeza dentro del frame (↑ = paneo hacia abajo)
  private static readonly HEAD_SIZE = 36;   // región de la cabeza (px origen) → ZOOM: ↓ más cerca, ↑ más lejos
  // Ajuste fino, en PÍXELES DEL AVATAR ya escalados (positivo = mueve el retrato a la derecha / abajo).
  private static readonly NUDGE_X = 0;
  private static readonly NUDGE_Y = 0;

  get portraitStyle(): Record<string, string> | null {
    const p = this.line ? NPC_PORTRAITS[this.line.speaker] : null;
    if (!p) return null;
    const F = NpcDialogueComponent.LPC_FRAME;
    const k = NpcDialogueComponent.AV_PX / NpcDialogueComponent.HEAD_SIZE;   // cabeza → avatar
    const col = p.frame % p.cols;
    const row = Math.floor(p.frame / p.cols);
    const srcX = col * F + NpcDialogueComponent.HEAD_X;
    const srcY = row * F + NpcDialogueComponent.HEAD_Y;
    const posX = -srcX * k + NpcDialogueComponent.NUDGE_X;
    const posY = -srcY * k + NpcDialogueComponent.NUDGE_Y;
    return {
      'background-image': `url(${p.sheet})`,
      'background-size': `${p.cols * F * k}px auto`,
      'background-position': `${posX}px ${posY}px`,
    };
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

  /**
   * Corta `line.text` en páginas de ≤2 líneas visuales. Mide contra el DOM REAL
   * (un div oculto que hereda fuente + letter-spacing del cuadro), no con canvas:
   * measureText ignora el letter-spacing y el kerning, así que subestimaba las líneas
   * y dejaba el texto en una sola página recortada por el clamp CSS (sin poder avanzar).
   */
  private paginate(): void {
    const el = this.dlgTextRef?.nativeElement;
    if (!el || !this.line) return;
    const avail = el.clientWidth;
    if (avail <= 0) { setTimeout(() => this.paginate()); return; }   // aún sin layout

    const cs = getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const maxTwoLines = lineHeight * 2 + 1;   // +1px de tolerancia de redondeo

    // Div de medición: mismo ancho y tipografía, pero sin recorte y con alto automático.
    const meas = document.createElement('div');
    Object.assign(meas.style, {
      position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0',
      width: avail + 'px', font: cs.font, fontFamily: cs.fontFamily,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
      wordSpacing: cs.wordSpacing, whiteSpace: 'normal',
    } as Partial<CSSStyleDeclaration>);
    // Colgado del cuadro padre (no del propio .dlg-text, que es un -webkit-box con
    // line-clamp que falsearía el alto). Hereda el letter-spacing real.
    const host = el.parentElement ?? document.body;
    host.appendChild(meas);

    const fits = (s: string) => { meas.textContent = s; return meas.clientHeight <= maxTwoLines; };

    let pages: string[];
    if (fits(this.line.text)) {
      pages = [this.line.text];   // cabe entero en 2 líneas → una sola página
    } else {
      // Reservamos el " …" en cada página (todas menos la última lo mostrarán).
      pages = [];
      const words = this.line.text.split(/\s+/).filter(Boolean);
      let cur: string[] = [];
      for (const w of words) {
        const test = [...cur, w];
        if (cur.length && !fits(test.join(' ') + ' …')) { pages.push(cur.join(' ')); cur = [w]; }
        else cur = test;
      }
      if (cur.length) pages.push(cur.join(' '));
    }

    host.removeChild(meas);
    this.pages = pages.length ? pages : [this.line.text];
    this.pageIndex = 0;
  }
}
