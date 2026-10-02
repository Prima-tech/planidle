import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatEntry, DialogueService } from 'src/app/services/dialogue.service';
import { GameSettingsService } from 'src/app/services/game-settings.service';

/**
 * Registro de chat de NPCs: ventana con el historial de lo hablado con los personajes
 * ("Mordekai: …"), lo más reciente abajo.
 *
 * La ventana la abre y la cierra el BOTÓN DEL CHAT DE LA BARRA INFERIOR (footer-bar),
 * no este componente: por eso el estado (abierto / sin leer) vive en DialogueService,
 * que es lo que comparten los dos.
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
  /** ¿Chat activado en Ajustes? Si no, se oculta la ventana. */
  enabled = this.gs.chatEnabled;

  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.dialogue.history$.subscribe(list => this.zone.run(() => {
      this.entries = list;
      if (this.open) this.scrollToBottomSoon();
    }));
    this.sub.add(this.dialogue.chatOpen$.subscribe(open => this.zone.run(() => {
      this.open = open;
      if (open) this.scrollToBottomSoon();
    })));
    // Ajuste "Chat": al desactivar, oculta la ventana y la cierra si estaba abierta.
    this.sub.add(this.gs.chatEnabled$.subscribe(v => this.zone.run(() => {
      this.enabled = v;
      if (!v) this.dialogue.closeChat();
    })));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Botón ✕ de la cabecera. */
  close(): void {
    this.dialogue.closeChat();
  }

  /** Tocar FUERA del chat lo cierra. El botón del footer queda excluido: si no, su
   *  pointerdown cerraría la ventana y su click la volvería a abrir al instante. */
  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: Event): void {
    if (!this.open) return;
    const target = ev.target as HTMLElement;
    if (this.host.nativeElement.contains(target)) return;
    if (target?.closest?.('[data-chat-toggle]')) return;
    this.zone.run(() => this.dialogue.closeChat());
  }

  /** Baja el scroll al último mensaje tras pintar (mensaje nuevo / al abrir). */
  private scrollToBottomSoon(): void {
    setTimeout(() => {
      const el = this.bodyRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
