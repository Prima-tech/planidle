import { Component, Input } from '@angular/core';
import { InventoryItem } from 'src/app/services/inventory.service';

const STAT_LABELS: Record<string, string> = {
  damage:   'Daño',
  healing:  'Curación',
  defense:  'Defensa',
  speed:    'Velocidad',
  critical: 'Crítico',
  stamina:  'Resistencia',
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
