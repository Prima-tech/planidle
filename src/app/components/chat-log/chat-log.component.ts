import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatEntry, DialogueService } from 'src/app/services/dialogue.service';

/**
 * Registro de chat de NPCs. Un botón (bocadillo) abajo-izquierda, sobre el tirador
 * del hub del footer; al pulsarlo abre una ventana de chat de juego con el historial
 * de lo hablado con los personajes ("Mordekai: …"), lo más reciente abajo.
 *
 * El historial vive en DialogueService.history$ (se rellena en cada línea mostrada).
 * Como el diálogo lo dispara la escena Phaser FUERA de la zona de Angular, se reentra
 * en NgZone para que el cambio se detecte y se pinte.
 */
@Component({
  selector: 'app-chat-log',
  templateUrl: './chat-log.component.html',
  styleUrls: ['./chat-log.component.scss'],
  standalone: false,
})
export class ChatLogComponent implements OnInit, OnDestroy {
  private dialogue = inject(DialogueService);
  private zone = inject(NgZone);

  @ViewChild('body') private bodyRef?: ElementRef<HTMLElement>;

  entries: ChatEntry[] = [];
  open = false;
  /** Mensajes nuevos desde la última vez que se abrió el chat (punto en el botón). */
  unread = 0;

  private lastSeenId = -1;
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.dialogue.history$.subscribe(list => this.zone.run(() => {
      this.entries = list;
      if (this.open) { this.markSeen(); this.scrollToBottomSoon(); }
      else { this.unread = list.filter(e => e.id > this.lastSeenId).length; }
    }));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) { this.markSeen(); this.scrollToBottomSoon(); }
  }

  /** Marca todo lo actual como visto (apaga el contador de no leídos). */
  private markSeen(): void {
    this.lastSeenId = this.entries.length ? this.entries[this.entries.length - 1].id : -1;
    this.unread = 0;
  }

  /** Baja el scroll al último mensaje tras pintar (mensaje nuevo / al abrir). */
  private scrollToBottomSoon(): void {
    setTimeout(() => {
      const el = this.bodyRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
