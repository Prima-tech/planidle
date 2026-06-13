import { Component, Input } from '@angular/core';
import { InventoryItem } from 'src/app/services/inventory.service';

const STAT_LABELS: Record<string, string> = {
  damage:   'ITEM_STAT.DAMAGE',
  healing:  'ITEM_STAT.HEALING',
  defense:  'ITEM_STAT.DEFENSE',
  speed:    'ITEM_STAT.SPEED',
  critical: 'ITEM_STAT.CRITICAL',
  stamina:  'ITEM_STAT.STAMINA',
};

@Component({
  selector: 'app-item-detail',
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-detail.component.scss'],
  standalone: false,
})
export class ItemDetailComponent {
  @Input() item: InventoryItem | null = null;
  @Input() panelStyle: { [key: string]: string } = {};

  statLabel(key: string): string {
    return STAT_LABELS[key] ?? key;
  }
}
