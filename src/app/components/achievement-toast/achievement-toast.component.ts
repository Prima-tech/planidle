import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AchievementService } from 'src/app/services/achievement.service';
import { QuestService } from 'src/app/services/quest.service';
import { UnlockService } from 'src/app/services/unlock.service';

/** Diseño del toast: 'gold' = placa de oro (logros y desbloqueos) · 'scroll' =
 *  pergamino (misiones). */
type ToastVariant = 'gold' | 'scroll';

interface Toast {
  icon: string;
  name: string;
  label: string;   // texto pequeño superior ("Logro desbloqueado" / "Misión completada")
  variant: ToastVariant;
  id: number;
  leaving: boolean;
}

const DURATION_MS = 6000;
const LEAVE_MS    = 400;

@Component({
  selector: 'app-achievement-toast',
  templateUrl: './achievement-toast.component.html',
  styleUrls: ['./achievement-toast.component.scss'],
  standalone: false,
})
export class AchievementToastComponent implements OnInit, OnDestroy {
  private achievements = inject(AchievementService);
  private quests = inject(QuestService);
  private unlocks = inject(UnlockService);
  private translate = inject(TranslateService);
  private subs: Subscription[] = [];
  private nextId = 0;

  toasts: Toast[] = [];

  ngOnInit(): void {
    this.subs.push(
      // Logros → placa de oro.
      this.achievements.unlocked$.subscribe(def =>
        this.show(def.icon, def.name, 'TOAST.ACHIEVEMENT_UNLOCKED', 'gold')),
      // Misiones → pergamino.
      this.quests.completed$.subscribe(def =>
        this.show(def.icon, def.name, 'TOAST.QUEST_COMPLETED', 'scroll')),
      // Solo las features con `toast` definido muestran pastilla (p.ej. mapas). Usan
      // el diseño de placa (desbloqueo genérico).
      this.unlocks.unlocked$.subscribe(def => {
        if (def.toast) this.show(def.toast.icon, def.name ?? '', def.toast.label, 'gold');
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private show(icon: string, name: string, label: string, variant: ToastVariant): void {
    // name/label pueden ser claves i18n (logros/misiones) o texto ya literal
    // (unlocks); instant() traduce las claves y deja el texto plano intacto.
    const toast: Toast = {
      icon,
      name: this.translate.instant(name),
      label: this.translate.instant(label),
      variant,
      id: this.nextId++, leaving: false,
    };
    this.toasts.push(toast);

    setTimeout(() => {
      toast.leaving = true;
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== toast.id);
      }, LEAVE_MS);
    }, DURATION_MS);
  }
}
