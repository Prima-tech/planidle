import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AchievementDef, AchievementService } from 'src/app/services/achievement.service';

interface Toast {
  def: AchievementDef;
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
  private sub: Subscription;
  private nextId = 0;

  toasts: Toast[] = [];

  ngOnInit(): void {
    this.sub = this.achievements.unlocked$.subscribe(def => this.show(def));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private show(def: AchievementDef): void {
    const toast: Toast = { def, id: this.nextId++, leaving: false };
    this.toasts.push(toast);

    setTimeout(() => {
      toast.leaving = true;
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== toast.id);
      }, LEAVE_MS);
    }, DURATION_MS);
  }
}
