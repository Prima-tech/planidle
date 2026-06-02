import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { TopBarComponent } from './top-bar/top-bar.component';
import { StatusBarComponent } from './status-bar/status-bar.component';
import { IconComponent } from './icon/icon.component';
import { InventoryComponent } from './inventory/inventory.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FooterBarComponent } from './footer-bar/footer-bar.component';
import { LayoutComponent } from './layout/layout.component';
import { RouterModule } from '@angular/router';
import { MapSelectedCellComponent } from './map-selected-cell/map-selected-cell.component';
import { ModalContainerComponent } from './modal-container/modal-container.component';
import { testPageComponent } from '../pages/test/test.page';
import { GameLogComponent } from './game-log/game-log.component';
import { SettingsPageComponent } from '../pages/settings/settings.page';
import { MapLabelComponent } from './map-label/map-label.component';
import { CharacterPageComponent } from '../pages/character/character.page';
import { MapStatsComponent } from './map-stats/map-stats.component';
import { OfflineGainsModalComponent } from './offline-gains-modal/offline-gains-modal.component';
import { MapKillsComponent } from './map-kills/map-kills.component';
import { DeathModalComponent } from './death-modal/death-modal.component';
import { StatsPageComponent } from './stats-page/stats-page.component';
import { EquipmentComponent } from './equipment/equipment.component';
import { ItemDetailComponent } from './item-detail/item-detail.component';

@NgModule({
  declarations: [
    TopBarComponent,
    StatusBarComponent,
    IconComponent,
    InventoryComponent,
    FooterBarComponent,
    LayoutComponent,
    MapSelectedCellComponent,
    ModalContainerComponent,
    testPageComponent,
    GameLogComponent,
    SettingsPageComponent,
    MapLabelComponent,
    CharacterPageComponent,
    MapStatsComponent,
    OfflineGainsModalComponent,
    MapKillsComponent,
    DeathModalComponent,
    StatsPageComponent,
    EquipmentComponent,
    ItemDetailComponent,
  ],
  imports: [
    CommonModule,
    IonicModule,
    DragDropModule,
    RouterModule,
    TranslateModule,
  ],
  exports: [
    TranslateModule,
    TopBarComponent,
    StatusBarComponent,
    IconComponent,
    InventoryComponent,
    FooterBarComponent,
    LayoutComponent,
    MapSelectedCellComponent,
    ModalContainerComponent,
    testPageComponent,
    GameLogComponent,
    SettingsPageComponent,
    MapLabelComponent,
    CharacterPageComponent,
    MapStatsComponent,
    OfflineGainsModalComponent,
    MapKillsComponent,
    DeathModalComponent,
    StatsPageComponent,
    EquipmentComponent,
    ItemDetailComponent,
  ]
})
export class ComponentModule {}