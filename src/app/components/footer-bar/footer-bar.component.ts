import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';
import { SettingsPageComponent } from 'src/app/pages/settings/settings.page';
import { CharacterPageComponent } from 'src/app/pages/character/character.page';
import { InventoryComponent } from '../inventory/inventory.component';
import { MapStatsComponent } from '../map-stats/map-stats.component';

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

  constructor(private router: Router) { }

  ngOnInit() { }

  goTo(tab: string) {
    this.router.navigate([`/${tab}`]);
  }

  openMenu() {
    if (this.menuModal.isOpenModal()) {
      this.menuModal.close();
    } else {
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
      this.characterModal.open(CharacterPageComponent, 'character');
    }
  }

  openMapStats() {
    if (this.mapStatsModal.isOpenModal()) {
      this.mapStatsModal.close();
    } else {
      this.mapStatsModal.open(MapStatsComponent, 'map-stats');
    }
  }

}
