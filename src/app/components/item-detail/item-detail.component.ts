import { Component, EventEmitter, Input, Output } from '@angular/core';
import { InventoryItem } from 'src/app/services/inventory.service';
import { itemDescription } from 'src/app/physics/griddrops';
import { BAG_SLOTS_BY_NAME } from 'src/app/services/inventory-unlock.service';
import { PET_MAX_LEVEL, petExpNeeded, petPickupRange } from 'src/app/pnj/pet/pet-config';

/** Etiquetas i18n por stat. Exportado para que la tienda (build-shop) muestre el
 *  mismo detalle de stats que el inventario. */
export const STAT_LABELS: Record<string, string> = {
  damage:        'ITEM_STAT.DAMAGE',
  damagePercent: 'ITEM_STAT.DAMAGE_PERCENT',
  magicDamage:   'ITEM_STAT.MAGIC_DAMAGE',
  hp:            'ITEM_STAT.HP',
  healing:  'ITEM_STAT.HEALING',
  defense:  'ITEM_STAT.DEFENSE',
  speed:    'ITEM_STAT.SPEED',
  critical: 'ITEM_STAT.CRITICAL',
  stamina:  'ITEM_STAT.STAMINA',
};

/** Stats que se muestran como porcentaje (sufijo '%'). */
export function isPercentStat(key: string): boolean {
  return key === 'damagePercent';
}

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

  /** Descripción del item: dato ESTÁTICO del catálogo de la app (no se guarda en el
   *  save ni se sincroniza). Se resuelve por nombre; fallback al valor guardado para
   *  items antiguos/mock que no estén en el catálogo. */
  get description(): string {
    if (!this.item) return '';
    return itemDescription(this.item.name) ?? this.item.description ?? '';
  }

  /** Consumible: cualquier item con curación (poción de vida). */
  get consumable(): boolean {
    return !!this.item?.stats?.['healing'];
  }

  /** Mascota: tiene petId. Muestra el bloque de nivel propio. */
  get isPet(): boolean {
    return !!this.item?.petId;
  }

  /** Nombre del personaje al que está vinculada la mascota (vacío si no lo está). */
  get boundCharName(): string {
    return this.item?.boundCharName ?? '';
  }

  /** Nivel actual de la mascota (1 por defecto). */
  get petLevel(): number {
    return this.item?.petLevel ?? 1;
  }

  readonly petMaxLevel = PET_MAX_LEVEL;

  get petIsMaxLevel(): boolean {
    return this.petLevel >= this.petMaxLevel;
  }

  /** Exp acumulada hacia el siguiente nivel. */
  get petExp(): number {
    return this.item?.petExp ?? 0;
  }

  /** Exp necesaria para el siguiente nivel (0 si ya está al máximo). */
  get petExpNeeded(): number {
    return this.petIsMaxLevel ? 0 : petExpNeeded(this.petLevel);
  }

  /** Rango de recogida actual de la mascota (px) según su nivel. */
  get petPickupRange(): number {
    return petPickupRange(this.petLevel);
  }

  /** Progreso 0..1 de la barra de exp (lleno al nivel máximo). */
  get petExpRatio(): number {
    if (this.petIsMaxLevel) return 1;
    const need = this.petExpNeeded;
    return need > 0 ? Math.min(1, this.petExp / need) : 0;
  }

  /** TEMPORAL (debug): nombre del fichero del icono para identificarlo. Quitar a futuro. */
  get iconName(): string {
    const src = this.item?.iconSheet || this.item?.icon || '';
    if (!src) return '';
    return src.split('/').pop() ?? src;
  }

  statLabel(key: string): string {
    return STAT_LABELS[key] ?? key;
  }

  /** Stats que representan un porcentaje → se muestran con sufijo '%'. */
  isPercentStat(key: string): boolean {
    return isPercentStat(key);
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
