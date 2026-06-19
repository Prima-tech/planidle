import { Component, inject } from '@angular/core';
import { DialogueService } from 'src/app/services/dialogue.service';

/**
 * Cuadro de diálogo de NPC. Escucha DialogueService.line$ (lo dispara la escena
 * Phaser al hablar con un NPC) y muestra un bocadillo abajo; se cierra al tocar.
 */
@Component({
  selector: 'app-npc-dialogue',
  templateUrl: './npc-dialogue.component.html',
  styleUrls: ['./npc-dialogue.component.scss'],
  standalone: false,
})
export class NpcDialogueComponent {
  private dialogue = inject(DialogueService);
  readonly line$ = this.dialogue.line$;

  dismiss(): void { this.dialogue.dismiss(); }
}
