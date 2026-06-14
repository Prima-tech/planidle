import { Component, EventEmitter, Input, Output } from '@angular/core';
import { InventoryItem } from 'src/app/services/inventory.service';
import { BAG_SLOTS_BY_NAME } from 'src/app/services/inventory-unlock.service';
import { PET_MAX_LEVEL } from 'src/app/pnj/pet/pet-config';

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
  /** Ítem con el que comparar (el seleccionado en el inventario). Activa los deltas. */
  @Input() compareWith?: InventoryItem | null;
  /** true → muestra el botón "Usar" para consumibles (solo desde el inventario). */
  @Input() canUse = false;
  /** Emite al pulsar "Equipar" (solo en modo comparador). */
  @Output() equip = new EventEmitter<void>();
  /** Emite al pulsar "Usar" (consumibles). */
  @Output() use = new EventEmitter<void>();

  /** Consumible: cualquier item con curación (poción de vida). */
  get consumable(): boolean {
    return !!this.item?.stats?.['healing'];
  }

  /** Mascota: tiene petId. Muestra el bloque de nivel propio. */
  get isPet(): boolean {
    return !!this.item?.petId;
  }

  /** Nivel actual de la mascota (1 por defecto). */
  get petLevel(): number {
    return this.item?.petLevel ?? 1;
  }

  readonly petMaxLevel = PET_MAX_LEVEL;

  /** Casillas 1..PET_MAX_LEVEL para pintar la barra de nivel. */
  get petLevelPips(): number[] {
    return Array.from({ length: this.petMaxLevel }, (_, i) => i + 1);
  }

  statLabel(key: string): string {
    return STAT_LABELS[key] ?? key;
  }

  /** Diferencia del ítem nuevo (compareWith) respecto a este, para un stat. */
  statDelta(key: string): number {
    return (this.compareWith?.stats?.[key] ?? 0) - (this.item?.stats?.[key] ?? 0);
  }

  private slotsOf(it: InventoryItem | null | undefined): number {
    if (!it) return 0;
    return it.inventorySlots ?? BAG_SLOTS_BY_NAME[it.name] ?? 0;
  }

  /** Huecos de inventario que añade una mochila (con fallback por nombre para saves antiguos). */
  get bagSlots(): number {
    return this.slotsOf(this.item);
  }

  /** Diferencia de huecos del ítem nuevo respecto a este. */
  get bagSlotsDelta(): number {
    return this.slotsOf(this.compareWith) - this.slotsOf(this.item);
  }

  getSheetPos(frame: number = 0, cols: number = 12, frameSize: number = 32, contentSize?: number): string {
    const cs    = contentSize ?? frameSize;
    const scale = 32 / cs;
    const col   = frame % cols;
    const row   = Math.floor(frame / cols);
    return `-${col * frameSize * scale}px -${row * frameSize * scale}px`;
  }

  getSheetBgSize(cols: number = 12, frameSize: number = 32, contentSize?: number): string {
    const cs = contentSize ?? frameSize;
    return `${cols * frameSize * (32 / cs)}px auto`;
  }
}
