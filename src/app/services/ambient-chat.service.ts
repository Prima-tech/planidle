import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DialogueService } from './dialogue.service';
import { UnlockService } from './unlock.service';
import { AsgardService } from './asgard';
import {
  AMBIENT_LINE_KEYS, AMBIENT_MAX_MS, AMBIENT_MIN_MS, CONVERSATION_CHANCE,
  NAMED_CHATTERS, OPENING_LINES,
} from './ambient-chat-config';

/** Un personaje elegible para hablar ahora mismo, con su repertorio de frases. */
interface Speaker { name: string; keys: string[]; }

/**
 * Charla ambiental del chat. Otros personajes NO controlados (héroes del roster
 * desbloqueados + personajes con voz propia, p. ej. Mordekai) publican frases al azar
 * en el registro de chat (`DialogueService.postChat` → NO abre el bocadillo), y a veces
 * conversan entre ellos (dos PJs se turnan varias frases).
 *
 * Se arranca/para en LayoutComponent (`start()`/`stop()`), como RegenService.
 */
@Injectable({ providedIn: 'root' })
export class AmbientChatService {
  private dialogue  = inject(DialogueService);
  private translate = inject(TranslateService);
  private unlocks   = inject(UnlockService);
  private asgard    = inject(AsgardService);

  private timers: ReturnType<typeof setTimeout>[] = [];
  private randomTimer?: ReturnType<typeof setTimeout>;
  private started = false;
  /** Nombres del roster (para la charla de héroes no controlados). Se lee en `start()`. */
  private rosterNames: string[] = [];

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      const chars = (await this.asgard.getCharacters()) ?? [];
      this.rosterNames = chars.map((c: any) => c?.name).filter(Boolean);
    } catch { this.rosterNames = []; }

    // Frases de apertura (Mordekai a los 10s, etc.).
    for (const l of OPENING_LINES) this.at(l.delayMs, () => this.post(l.speaker, l.key));

    this.scheduleRandom();
  }

  stop(): void {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    if (this.randomTimer) clearTimeout(this.randomTimer);
    this.randomTimer = undefined;
    this.started = false;
  }

  /** Dispara una frase suelta de un personaje concreto (uso externo puntual). */
  say(speaker: string, key: string): void { this.post(speaker, key); }

  // ── Interno ────────────────────────────────────────────────────────────────

  private at(ms: number, fn: () => void): void { this.timers.push(setTimeout(fn, ms)); }

  private scheduleRandom(): void {
    const delay = AMBIENT_MIN_MS + Math.floor(Math.random() * (AMBIENT_MAX_MS - AMBIENT_MIN_MS));
    this.randomTimer = setTimeout(() => { this.tickRandom(); this.scheduleRandom(); }, delay);
  }

  private tickRandom(): void {
    const eligible = this.eligibleSpeakers();
    if (!eligible.length) return;
    if (eligible.length >= 2 && Math.random() < CONVERSATION_CHANCE) {
      this.playDynamicConversation(eligible);
    } else {
      const s = this.pick(eligible);
      this.post(s.name, this.pick(s.keys));
    }
  }

  /** Conversación improvisada: dos PJs distintos se turnan 3 frases (A, B, A). */
  private playDynamicConversation(pool: Speaker[]): void {
    const a = this.pick(pool);
    let b = this.pick(pool);
    for (let guard = 0; b.name === a.name && guard < 5; guard++) b = this.pick(pool);
    if (b.name === a.name) return;

    let t = 0;
    for (const sp of [a, b, a]) {
      const speaker = sp;   // captura por turno
      this.at(t, () => this.post(speaker.name, this.pick(speaker.keys)));
      t += 2600 + Math.floor(Math.random() * 1800);   // 2.6–4.4s entre turnos
    }
  }

  /** Personajes que pueden hablar ahora: con voz propia desbloqueados + héroes del
   *  roster desbloqueados que NO sean el que controlas. */
  private eligibleSpeakers(): Speaker[] {
    const list: Speaker[] = [];

    for (const c of NAMED_CHATTERS) {
      if (!c.requiresUnlock || this.unlocks.isCharacterUnlocked(c.requiresUnlock)) {
        list.push({ name: c.name, keys: c.lineKeys });
      }
    }

    const named = new Set(list.map(s => s.name));
    const selected = this.asgard.selectedPlayer?.name;
    for (const name of this.rosterNames) {
      if (!name || name === selected || named.has(name)) continue;
      if (!this.unlocks.isCharacterUnlocked(name)) continue;
      list.push({ name, keys: AMBIENT_LINE_KEYS });
    }

    return list;
  }

  private pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  private post(speaker: string, key: string): void {
    this.dialogue.postChat(speaker, this.translate.instant(key));
  }
}
