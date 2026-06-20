import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { DialogueService, DialogueLine } from 'src/app/services/dialogue.service';

/**
 * Cuadro de diálogo de NPC. Escucha DialogueService.line$ (lo dispara la escena
 * Phaser al hablar con un NPC) y muestra un bocadillo abajo; se cierra al tocar o
 * al alejarse. Al cerrarse reproduce una animación de salida antes de quitarse del
 * DOM (por eso gestionamos `line`/`leaving` a mano en vez de un *ngIf directo).
 */
@Component({
  selector: 'app-npc-dialogue',
  templateUrl: './npc-dialogue.component.html',
  styleUrls: ['./npc-dialogue.component.scss'],
  standalone: false,
})
export class NpcDialogueComponent implements OnInit, OnDestroy {
  private dialogue = inject(DialogueService);

  line: DialogueLine | null = null;
  leaving = false;

  private static readonly LEAVE_MS = 180;
  private sub?: Subscription;
  private leaveTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.sub = this.dialogue.line$.subscribe(line => {
      if (line) {
        clearTimeout(this.leaveTimer);
        this.leaving = false;
        this.line = line;
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

  /** Toque en el cuadro: avanza si hay más líneas; en la última, cierra. */
  onBoxClick(): void {
    if (this.line?.hasNext) this.dialogue.advance();
    else this.dialogue.dismiss();
  }

  dismiss(): void { this.dialogue.dismiss(); }
}
