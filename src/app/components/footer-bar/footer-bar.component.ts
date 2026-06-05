import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';
import { SettingsPageComponent } from 'src/app/pages/settings/settings.page';
import { InventoryComponent } from '../inventory/inventory.component';
import { EquipmentComponent } from '../equipment/equipment.component';
import { MapStatsComponent } from '../map-stats/map-stats.component';
import { MapKillsComponent } from '../map-kills/map-kills.component';
import { StatsPageComponent } from '../stats-page/stats-page.component';
import { SummonComponent } from '../summon/summon.component';

@Component({
  selector: 'app-footer-bar',
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss'],
  standalone: false
})
export class FooterBarComponent implements OnInit {
  @ViewChild('menuModal')      menuModal!:      ModalContainerComponent;
  @ViewChild('inventoryModal') inventoryModal!: ModalContainerComponent;
  @ViewChild('equipmentModal') equipmentModal!: ModalContainerComponent;
  @ViewChild('mapStatsModal')  mapStatsModal!:  ModalContainerComponent;
  @ViewChild('mapKillsModal')  mapKillsModal!:  ModalContainerComponent;
  @ViewChild('statsModal')     statsModal!:     ModalContainerComponent;
  @ViewChild('summonModal')    summonModal!:    ModalContainerComponent;

  constructor() { }

  ngOnInit() { }

  private closeOtherOnSide(side: 'left' | 'right', except: ModalContainerComponent) {
    const groups: Record<'left' | 'right', ModalContainerComponent[]> = {
      left: [this.summonModal, this.equipmentModal],
      right: [this.menuModal, this.mapStatsModal, this.mapKillsModal, this.statsModal, this.inventoryModal],
    };
    groups[side].forEach(m => { if (m !== except && m.isOpenModal()) m.close(); });
  }

  openMenu() {
    if (this.menuModal.isOpenModal()) {
      this.menuModal.close();
    } else {
      this.closeOtherOnSide('right', this.menuModal);
      this.menuModal.open(SettingsPageComponent, 'menu');
    }
  }

  openInventory() {
    if (this.inventoryModal.isOpenModal()) {
      this.inventoryModal.close();
    } else {
      this.closeOtherOnSide('right', this.inventoryModal);
      this.inventoryModal.open(InventoryComponent, 'inventory');
    }
  }

  openEquipment() {
    if (this.equipmentModal.isOpenModal()) {
      this.equipmentModal.close();
    } else {
      this.closeOtherOnSide('left', this.equipmentModal);
      this.equipmentModal.open(EquipmentComponent, 'equipment');
    }
  }

openMapStats() {
    if (this.mapStatsModal.isOpenModal()) {
      this.mapStatsModal.close();
    } else {
      this.closeOtherOnSide('right', this.mapStatsModal);
      this.mapStatsModal.open(MapStatsComponent, 'map-stats');
    }
  }

  openMapKills() {
    if (this.mapKillsModal.isOpenModal()) {
      this.mapKillsModal.close();
    } else {
      this.closeOtherOnSide('right', this.mapKillsModal);
      this.mapKillsModal.open(MapKillsComponent, 'map-kills');
    }
  }

  openStats() {
    if (this.statsModal.isOpenModal()) {
      this.statsModal.close();
    } else {
      this.closeOtherOnSide('right', this.statsModal);
      this.statsModal.open(StatsPageComponent, 'stats');
    }
  }

  openSummon() {
    if (this.summonModal.isOpenModal()) {
      this.summonModal.close();
    } else {
      this.closeOtherOnSide('left', this.summonModal);
      this.summonModal.open(SummonComponent, 'summon');
    }
  }

}
