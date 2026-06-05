import { Component, OnInit } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { EquipmentService, EquipmentSlot } from 'src/app/services/equipment.service';
import { InventoryItem, InventoryService } from 'src/app/services/inventory.service';
import { CharacterStatsService, BaseStats } from 'src/app/services/character-stats.service';
import { PlayerStateService, expNeeded, MAX_LEVEL } from 'src/app/services/player-state.service';

@Component({
  selector: 'app-equipment',
  templateUrl: './equipment.component.html',
  styleUrls: ['./equipment.component.scss'],
  standalone: false,
})
export class EquipmentComponent implements OnInit {

  activeTab = 0;
  showAtkBreakdown = false;
  readonly damage$ = this.charStats.damage$;
  readonly expNeeded = expNeeded;
  readonly maxLevel = MAX_LEVEL;

  readonly statsList: { key: keyof BaseStats; label: string }[] = [
    { key: 'STR',   label: 'Fuerza'        },
    { key: 'DEX',   label: 'Destreza'      },
    { key: 'CONST', label: 'Constitución'  },
    { key: 'INT',   label: 'Inteligencia'  },
    { key: 'MAG',   label: 'Magia'         },
    { key: 'CHR',   label: 'Carisma'       },
  ];

  constructor(
    public equipmentService: EquipmentService,
    private inventoryService: InventoryService,
    public charStats: CharacterStatsService,
    public playerState: PlayerStateService,
  ) {}

  ngOnInit(): void {}

  // Predicate: sólo acepta ítems compatibles con este slot
  canDropInSlot = (drag: CdkDrag, drop: CdkDropList): boolean => {
    return this.equipmentService.canEquip(drag.data?.item, drop.id);
  };

  onEquipDrop(event: CdkDragDrop<any>, slot: EquipmentSlot): void {
    const data = event.item.data;
    const item: InventoryItem = data.item;

    if (!this.equipmentService.canEquip(item, `equip-${slot.id}`)) return;

    const displaced = this.equipmentService.equip(`equip-${slot.id}`, item);

    if (data.sourceContext === 'inventory') {
      // Quitar del inventario
      this.inventoryService.removeRequest$.next({
        tabIndex: data.tabIndex,
        row: data.row,
        col: data.col,
      });
      // Si había un ítem en el slot, devolver al inventario
      if (displaced) {
        this.inventoryService.itemDropped$.next(displaced);
      }
    }
    // Si sourceContext === 'equipment' (mismo componente), no hace nada adicional
    // porque equip() ya reemplazó el slot con el nuevo ítem
  }

  getSheetPos(frame: number = 0): string {
    const cols = 12;
    const size = 32;
    const col  = frame % cols;
    const row  = Math.floor(frame / cols);
    return `-${col * size}px -${row * size}px`;
  }
}
