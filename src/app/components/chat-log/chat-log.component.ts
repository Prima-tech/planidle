import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatEntry, DialogueService } from 'src/app/services/dialogue.service';
import { GameSettingsService } from 'src/app/services/game-settings.service';

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
  private gs = inject(GameSettingsService);
  private host = inject(ElementRef) as ElementRef<HTMLElement>;

  @ViewChild('body') private bodyRef?: ElementRef<HTMLElement>;

  entries: ChatEntry[] = [];
  open = false;
  /** ¿Chat activado en Ajustes? Si no, se oculta el botón y la ventana. */
  enabled = this.gs.chatEnabled;
  /** Mensajes nuevos desde la última vez que se abrió el chat (punto en el botón). */
  unread = 0;

  private lastSeenId = -1;
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.dialogue.history$.subscribe(list => this.zone.run(() => {
      this.entries = list;
      if (this.open) { this.markSeen(); this.scrollToBottomSoon(); }
      // Novedad SOLO por mensajes no solicitados (ambient); el diálogo activo ya lo ves.
      else { this.unread = list.filter(e => e.id > this.lastSeenId && e.ambient).length; }
    }));
    // Ajuste "Chat": al desactivar, oculta el botón/ventana y cierra si estaba abierto.
    this.sub.add(this.gs.chatEnabled$.subscribe(v => this.zone.run(() => {
      this.enabled = v;
      if (!v) this.open = false;
    })));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) { this.markSeen(); this.scrollToBottomSoon(); }
  }

  /** Tocar FUERA del chat (ni botón ni ventana) lo cierra. */
  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: Event): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.open = false;
    }
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
