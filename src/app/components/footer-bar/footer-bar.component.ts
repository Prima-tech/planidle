import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';
import { SettingsPageComponent } from 'src/app/pages/settings/settings.page';
import { CharacterPageComponent } from 'src/app/pages/character/character.page';
import { InventoryComponent } from '../inventory/inventory.component';
import { MapStatsComponent } from '../map-stats/map-stats.component';
import { MapKillsComponent } from '../map-kills/map-kills.component';

@Component({
  selector: 'app-footer-bar',
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss'],
  standalone: false
})
export class FooterBarComponent implements OnInit {
  @ViewChild('menuModal') menuModal!: ModalContainerComponent;
  @ViewChild('characterModal') characterModal!: ModalContainerComponent;
  @ViewChild('inventoryModal') inventoryModal!: ModalContainerComponent;
  @ViewChild('mapStatsModal') mapStatsModal!: ModalContainerComponent;
  @ViewChild('mapKillsModal') mapKillsModal!: ModalContainerComponent;

  constructor(private router: Router) { }

  ngOnInit() { }

  goTo(tab: string) {
    this.router.navigate([`/${tab}`]);
  }

  private closeOtherOnSide(side: 'left' | 'right', except: ModalContainerComponent) {
    const groups: Record<'left' | 'right', ModalContainerComponent[]> = {
      left: [this.characterModal],
      right: [this.menuModal, this.mapStatsModal, this.mapKillsModal],
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
      this.inventoryModal.open(InventoryComponent, 'inventory');
    }
  }

  openStatus() {
    if (this.characterModal.isOpenModal()) {
      this.characterModal.close();
    } else {
      this.closeOtherOnSide('left', this.characterModal);
      this.characterModal.open(CharacterPageComponent, 'character');
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

}
