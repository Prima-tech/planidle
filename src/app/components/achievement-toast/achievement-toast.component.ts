import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AchievementService } from 'src/app/services/achievement.service';
import { QuestService } from 'src/app/services/quest.service';

interface Toast {
  icon: string;
  name: string;
  label: string;   // texto pequeño superior ("Logro desbloqueado" / "Misión completada")
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
  private subs: Subscription[] = [];
  private nextId = 0;

  toasts: Toast[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.achievements.unlocked$.subscribe(def =>
        this.show(def.icon, def.name, 'Logro desbloqueado')),
      this.quests.completed$.subscribe(def =>
        this.show(def.icon, def.name, 'Misión completada')),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private show(icon: string, name: string, label: string): void {
    const toast: Toast = { icon, name, label, id: this.nextId++, leaving: false };
    this.toasts.push(toast);

    setTimeout(() => {
      toast.leaving = true;
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== toast.id);
      }, LEAVE_MS);
    }, DURATION_MS);
  }
}
