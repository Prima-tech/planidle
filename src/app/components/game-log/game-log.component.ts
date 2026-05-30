import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { InventoryService } from 'src/app/services/inventory.service';

interface LogEntry {
  id: number;
  text: string;
  type: 'drop' | 'event';
  fading: boolean;
}

let nextId = 0;
const VISIBLE_MS = 3000;
const FADE_MS = 500;

@Component({
  selector: 'app-game-log',
  templateUrl: './game-log.component.html',
  styleUrls: ['./game-log.component.scss'],
  standalone: false
})
export class GameLogComponent implements OnInit, OnDestroy {
  entries: LogEntry[] = [];
  private sub: Subscription;

  constructor(private inventoryService: InventoryService) {}

  ngOnInit() {
    this.sub = this.inventoryService.itemDropped$.subscribe(item => {
      const qty = item.sum && item.sum > 1 ? ` x${item.sum}` : '';
      this.addEntry(`+ ${item.name}${qty}`, 'drop');
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  addEntry(text: string, type: LogEntry['type'] = 'event') {
    const entry: LogEntry = { id: nextId++, text, type, fading: false };
    this.entries.push(entry);

    setTimeout(() => {
      entry.fading = true;
      setTimeout(() => {
        this.entries = this.entries.filter(e => e.id !== entry.id);
      }, FADE_MS);
    }, VISIBLE_MS);
  }
}
