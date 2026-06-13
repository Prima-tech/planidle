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
import { OfflineGainsModalComponent } from './offline-gains-modal/offline-gains-modal.component';
import { DeathModalComponent } from './death-modal/death-modal.component';
import { EquipmentComponent } from './equipment/equipment.component';
import { ItemDetailComponent } from './item-detail/item-detail.component';
import { CharStatsComponent } from './char-stats/char-stats.component';
import { SummonComponent } from './summon/summon.component';
import { TownChestComponent } from './town-chest/town-chest.component';
import { PlayerPreviewComponent } from './player-preview/player-preview.component';
import { SkillSlotsPanelComponent } from './skill-slots-panel/skill-slots-panel.component';
import { SkillDetailComponent } from './skill-detail/skill-detail.component';
import { GameSettingsPageComponent } from '../pages/game-settings/game-settings.page';
import { HudSkillButtonsComponent } from './hud-skill-buttons/hud-skill-buttons.component';
import { AttackButtonComponent } from './attack-button/attack-button.component';
import { WorldMapPanelComponent } from './world-map-panel/world-map-panel.component';
import { EnemyNamePipe } from '../pipes/enemy-name.pipe';
import { CharacterSpriteComponent } from './character-sprite/character-sprite.component';
import { ProgressPanelComponent } from './progress-panel/progress-panel.component';
import { AchievementToastComponent } from './achievement-toast/achievement-toast.component';
import { QuestTrackerComponent } from './quest-tracker/quest-tracker.component';
import { ShopComponent } from './shop/shop.component';
import { BuildPanelComponent } from './build-panel/build-panel.component';

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
    OfflineGainsModalComponent,
    DeathModalComponent,
    EquipmentComponent,
    ItemDetailComponent,
    CharStatsComponent,
    SummonComponent,
    TownChestComponent,
    PlayerPreviewComponent,
    SkillSlotsPanelComponent,
    SkillDetailComponent,
    GameSettingsPageComponent,
    HudSkillButtonsComponent,
    AttackButtonComponent,
    WorldMapPanelComponent,
    EnemyNamePipe,
    CharacterSpriteComponent,
    ProgressPanelComponent,
    AchievementToastComponent,
    QuestTrackerComponent,
    ShopComponent,
    BuildPanelComponent,
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
    OfflineGainsModalComponent,
    DeathModalComponent,
    EquipmentComponent,
    ItemDetailComponent,
    CharStatsComponent,
    SummonComponent,
    TownChestComponent,
    HudSkillButtonsComponent,
    EnemyNamePipe,
    CharacterSpriteComponent,
    AchievementToastComponent,
    QuestTrackerComponent,
  ]
})
export class ComponentModule {}