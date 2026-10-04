import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatEntry, DialogueService } from 'src/app/services/dialogue.service';
import { GameSettingsService } from 'src/app/services/game-settings.service';
import { GameLogService, LogEntry } from 'src/app/services/game-log.service';

/** Pestañas de la ventana: diálogos, progreso (botín/recetas/niveles) y combate. */
type ChatTab = 'chat' | 'loot' | 'combat';

/**
 * Ventana de chat con 3 pestañas, lo más reciente abajo:
 *   - Chat: lo hablado con los personajes ("Mordekai: …") — DialogueService.history$.
 *   - Progreso: objetos y oro recogidos, recetas, niveles, misiones — GameLogService.loot$.
 *   - Combate: golpes dados y recibidos, esquivas, bajas — GameLogService.combat$.
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
  private log = inject(GameLogService);
  private host = inject(ElementRef) as ElementRef<HTMLElement>;

  @ViewChild('body') private bodyRef?: ElementRef<HTMLElement>;

  entries: ChatEntry[] = [];
  /** Líneas de la pestaña de registro activa (Progreso o Combate). */
  logEntries: LogEntry[] = [];
  /** Pestaña activa. Estática: sobrevive a que el componente se recree (cambio de mapa). */
  private static lastTab: ChatTab = 'chat';
  tab: ChatTab = ChatLogComponent.lastTab;
  private loot: LogEntry[] = [];
  private combat: LogEntry[] = [];
  open = false;
  /** ¿Chat activado en Ajustes? Si no, se oculta la ventana. */
  enabled = this.gs.chatEnabled;

  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.dialogue.history$.subscribe(list => this.zone.run(() => {
      const stick = this.atBottom();
      this.entries = list;
      if (this.open && this.tab === 'chat' && stick) this.scrollToBottomSoon();
    }));
    // Registros: llegan desde la escena Phaser (fuera de la zona). Se guardan SIEMPRE,
    // pero solo se reentra en NgZone (= change detection de toda la app) si la ventana
    // está abierta en esa pestaña: en combate AFK llegan golpes sin parar y entrar en la
    // zona en cada uno daba tirones en móvil aunque el chat estuviera cerrado.
    this.sub.add(this.log.loot$.subscribe(list => { this.loot = list; this.onLog('loot'); }));
    this.sub.add(this.log.combat$.subscribe(list => { this.combat = list; this.onLog('combat'); }));
    this.sub.add(this.dialogue.chatOpen$.subscribe(open => this.zone.run(() => {
      this.open = open;
      // Lo llegado con la ventana cerrada no se pintó: refrescar la pestaña al abrir.
      if (open && this.tab !== 'chat') this.logEntries = this.tab === 'loot' ? this.loot : this.combat;
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

  setTab(tab: ChatTab): void {
    this.tab = ChatLogComponent.lastTab = tab;
    this.logEntries = tab === 'loot' ? this.loot : tab === 'combat' ? this.combat : [];
    this.scrollToBottomSoon();
  }

  trackLog(_: number, e: LogEntry): number | string { return e.id; }

  /** Llegó una línea a un registro: si es la pestaña visible, la pinta y baja el scroll
   *  — salvo que estés leyendo más arriba (no te arranca de donde estás). */
  private onLog(ch: 'loot' | 'combat'): void {
    if (this.tab !== ch || !this.open) return;   // al abrir / cambiar de pestaña se refresca
    this.zone.run(() => {
      const stick = this.atBottom();
      this.logEntries = ch === 'loot' ? this.loot : this.combat;
      if (stick) this.scrollToBottomSoon();
    });
  }

  /** ¿El historial está pegado abajo (o aún no hay ventana)? */
  private atBottom(): boolean {
    const el = this.bodyRef?.nativeElement;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 24;
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
