import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';
import { SettingsPageComponent } from 'src/app/pages/settings/settings.page';
import { InventoryComponent } from '../inventory/inventory.component';
import { EquipmentComponent } from '../equipment/equipment.component';
import { MapStatsComponent } from '../map-stats/map-stats.component';
import { MapKillsComponent } from '../map-kills/map-kills.component';
import { StatsPageComponent } from '../stats-page/stats-page.component';
import { SummonComponent } from '../summon/summon.component';
import { SkillSlotsPanelComponent } from '../skill-slots-panel/skill-slots-panel.component';
import { SkillDetailComponent } from '../skill-detail/skill-detail.component';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { TalentService } from 'src/app/services/talent.service';

@Component({
  selector: 'app-footer-bar',
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss'],
  standalone: false
})
export class FooterBarComponent implements OnInit, OnDestroy {
  @ViewChild('menuModal')        menuModal!:        ModalContainerComponent;
  @ViewChild('inventoryModal')   inventoryModal!:   ModalContainerComponent;
  @ViewChild('equipmentModal')   equipmentModal!:   ModalContainerComponent;
  @ViewChild('mapStatsModal')    mapStatsModal!:    ModalContainerComponent;
  @ViewChild('mapKillsModal')    mapKillsModal!:    ModalContainerComponent;
  @ViewChild('statsModal')       statsModal!:       ModalContainerComponent;
  @ViewChild('summonModal')      summonModal!:      ModalContainerComponent;
  @ViewChild('skillSlotsModal')  skillSlotsModal!:  ModalContainerComponent;
  @ViewChild('skillDetailModal') skillDetailModal!: ModalContainerComponent;

  private detailSub: Subscription;
  private closeSub:  Subscription;

  page: 'main' | 'skills' = 'main';
  activeSkillSlot: number | null = null;

  private skillEquipService = inject(SkillEquipService);
  private talentService     = inject(TalentService);

  constructor() { }

  ngOnInit() {
    this.detailSub = this.skillEquipService.openDetail$.subscribe(() => {
      this.closeOtherOnSide('left', this.skillDetailModal);
      this.skillDetailModal.open(SkillDetailComponent, 'skill-detail');
    });
    this.closeSub = this.skillEquipService.closeSkillPanels$.subscribe(() => {
      if (this.skillDetailModal?.isOpenModal()) this.skillDetailModal.close();
      if (this.skillSlotsModal?.isOpenModal())  this.skillSlotsModal.close();
      this.activeSkillSlot = null;
      this.skillEquipService.activeSlot      = null;
      this.skillEquipService.selectedAbilityId = null;
    });
  }

  ngOnDestroy() {
    this.detailSub?.unsubscribe();
    this.closeSub?.unsubscribe();
  }

  slotIcon(slot: number): string | null {
    const id = this.skillEquipService.slots[slot];
    if (!id) return null;
    return this.talentService.nodes.find(n => n.id === id)?.icon ?? null;
  }

  slotLabel(slot: number): string | null {
    const id = this.skillEquipService.slots[slot];
    if (!id) return null;
    const node = this.talentService.nodes.find(n => n.id === id);
    return node?.label?.split('\n')[0] ?? null;
  }

  private closeOtherOnSide(side: 'left' | 'right', except: ModalContainerComponent) {
    const groups: Record<'left' | 'right', ModalContainerComponent[]> = {
      left:  [this.summonModal, this.equipmentModal, this.skillDetailModal],
      right: [this.menuModal, this.mapStatsModal, this.mapKillsModal, this.statsModal, this.inventoryModal, this.skillSlotsModal],
    };
    groups[side].forEach(m => { if (m !== except && m?.isOpenModal()) m.close(); });
  }

  togglePage() {
    if (this.page === 'main') {
      [this.menuModal, this.inventoryModal, this.equipmentModal,
       this.mapStatsModal, this.mapKillsModal, this.statsModal, this.summonModal]
        .forEach(m => { if (m?.isOpenModal()) m.close(); });
      this.page = 'skills';
    } else {
      if (this.skillSlotsModal?.isOpenModal()) this.skillSlotsModal.close();
      this.activeSkillSlot = null;
      this.page = 'main';
    }
  }

  openSkillSlot(slot: number) {
    if (this.activeSkillSlot === slot && this.skillSlotsModal.isOpenModal()) {
      this.skillSlotsModal.close();
      this.activeSkillSlot = null;
      this.skillEquipService.activeSlot = null;
    } else {
      this.closeOtherOnSide('right', this.skillSlotsModal);
      this.skillEquipService.activeSlot = slot;
      this.skillSlotsModal.open(SkillSlotsPanelComponent, 'skill-slots');
      this.activeSkillSlot = slot;
    }
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
