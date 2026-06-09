import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';
import { SettingsPageComponent } from 'src/app/pages/settings/settings.page';
import { GameSettingsPageComponent } from 'src/app/pages/game-settings/game-settings.page';
import { InventoryComponent } from '../inventory/inventory.component';
import { EquipmentComponent } from '../equipment/equipment.component';
import { MapStatsComponent } from '../map-stats/map-stats.component';
import { MapKillsComponent } from '../map-kills/map-kills.component';
import { StatsPageComponent } from '../stats-page/stats-page.component';
import { SummonComponent } from '../summon/summon.component';
import { SkillSlotsPanelComponent } from '../skill-slots-panel/skill-slots-panel.component';
import { SkillDetailComponent } from '../skill-detail/skill-detail.component';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { TalentService, SPHERE_MULT } from 'src/app/services/talent.service';
import { SkillActivationService } from 'src/app/services/skill-activation.service';
import { SKILL_REGISTRY } from 'src/app/services/skill-config';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { AutoAttackService } from 'src/app/services/auto-attack.service';

@Component({
  selector: 'app-footer-bar',
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss'],
  standalone: false
})
export class FooterBarComponent implements OnInit, OnDestroy {
  @ViewChild('menuModal')        menuModal!:        ModalContainerComponent;
  @ViewChild('gameSettingsModal') gameSettingsModal!: ModalContainerComponent;
  @ViewChild('inventoryModal')   inventoryModal!:   ModalContainerComponent;
  @ViewChild('equipmentModal')   equipmentModal!:   ModalContainerComponent;
  @ViewChild('mapStatsModal')    mapStatsModal!:    ModalContainerComponent;
  @ViewChild('mapKillsModal')    mapKillsModal!:    ModalContainerComponent;
  @ViewChild('statsModal')       statsModal!:       ModalContainerComponent;
  @ViewChild('summonModal')      summonModal!:      ModalContainerComponent;
  @ViewChild('skillSlotsModal')  skillSlotsModal!:  ModalContainerComponent;
  @ViewChild('skillDetailModal') skillDetailModal!: ModalContainerComponent;

  private detailSub:        Subscription;
  private closeSub:         Subscription;
  private activateSub:      Subscription;
  private sceneStartingSub: Subscription;
  private cdInterval:       ReturnType<typeof setInterval> | null = null;

  page: 'main' | 'skills' = 'main';
  activeSkillSlot: number | null = null;
  locked = true;

  readonly skillSlots = [1,2,3,4,5,6,7,8,9,10];
  // grados 0-360 del arco de cooldown para cada slot
  cdAngles:  Record<number, number> = Object.fromEntries(this.skillSlots.map(s => [s, 0]));
  // texto de segundos restantes ("2", "0.5", …) o vacío
  cdSeconds: Record<number, string> = Object.fromEntries(this.skillSlots.map(s => [s, '']));
  // slots con la animación de activación activa
  private flashSlots = new Set<number>();

  private skillEquipService      = inject(SkillEquipService);
  private talentService          = inject(TalentService);
  private skillActivationService = inject(SkillActivationService);
  private playerBridge           = inject(PlayerBridgeService);
  autoAttack                     = inject(AutoAttackService);

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
      this.skillEquipService.activeSlot       = null;
      this.skillEquipService.selectedAbilityId = null;
    });
    this.sceneStartingSub = this.playerBridge.sceneStarting$.subscribe(() => {
      this.page = 'main';
      this.locked = true;
      this.activeSkillSlot = null;
      this.skillEquipService.activeSlot        = null;
      this.skillEquipService.selectedAbilityId = null;
    });

    this.activateSub = this.skillActivationService.activate$.subscribe(({ abilityId }) => {
      for (const slot of this.skillSlots) {
        if (this.slotAbility(slot) === abilityId) { this.triggerFlash(slot); break; }
      }
      this.startCdLoop();
    });
  }

  ngOnDestroy() {
    this.detailSub?.unsubscribe();
    this.closeSub?.unsubscribe();
    this.activateSub?.unsubscribe();
    this.sceneStartingSub?.unsubscribe();
    if (this.cdInterval) clearInterval(this.cdInterval);
  }

  slotIcon(slot: number): string | null {
    const id = this.skillEquipService.slots[slot];
    if (!id) return null;
    return this.talentService.nodes.find(n => n.id === id)?.icon ?? null;
  }

  slotIconImage(slot: number): string | null {
    const ability = this.slotAbility(slot);
    return ability ? (SKILL_REGISTRY[ability]?.iconPath ?? null) : null;
  }

  slotNoTarget(slot: number): boolean {
    const ability = this.slotAbility(slot);
    return !!ability && this.cdAngles[slot] === 0 && !this.skillActivationService.hasTarget(ability);
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
      right: [this.menuModal, this.gameSettingsModal, this.mapStatsModal, this.mapKillsModal, this.statsModal, this.inventoryModal, this.skillSlotsModal],
    };
    groups[side].forEach(m => { if (m !== except && m?.isOpenModal()) m.close(); });
  }

  toggleAutoAttack() {
    this.autoAttack.toggle();
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

  toggleLock() {
    this.locked = !this.locked;
    if (this.locked) {
      if (this.skillSlotsModal?.isOpenModal())  this.skillSlotsModal.close();
      if (this.skillDetailModal?.isOpenModal()) this.skillDetailModal.close();
      this.activeSkillSlot = null;
      this.skillEquipService.activeSlot      = null;
      this.skillEquipService.selectedAbilityId = null;
    }
  }

  onSkillSlotClick(slot: number) {
    if (this.locked) {
      this.activateSkill(slot);
    } else {
      this.openSkillSlot(slot);
    }
  }

  private activateSkill(slot: number): void {
    const nodeId = this.skillEquipService.slots[slot];
    if (!nodeId) return;
    const node = this.talentService.nodes.find(n => n.id === nodeId);
    if (!node?.effect?.ability) return;
    const sphere = this.talentService.slotted[nodeId];
    const damage = node.effect.base * (sphere ? SPHERE_MULT[sphere] : 1);
    this.skillActivationService.request(node.effect.ability, damage);
  }

  isFlashing(slot: number): boolean { return this.flashSlots.has(slot); }

  slotAbility(slot: number): string | null {
    const nodeId = this.skillEquipService.slots[slot];
    if (!nodeId) return null;
    return this.talentService.nodes.find(n => n.id === nodeId)?.effect?.ability ?? null;
  }

  private triggerFlash(slot: number): void {
    this.flashSlots.add(slot);
    setTimeout(() => this.flashSlots.delete(slot), 400);
  }

  private startCdLoop(): void {
    if (this.cdInterval) return;
    this.cdInterval = setInterval(() => {
      let anyActive = false;
      for (const slot of this.skillSlots) {
        const ability = this.slotAbility(slot);
        if (!ability) { this.cdAngles[slot] = 0; this.cdSeconds[slot] = ''; continue; }
        const ratio = this.skillActivationService.cooldownRatio(ability);
        const secs  = this.skillActivationService.cooldownRemaining(ability);
        this.cdAngles[slot]  = ratio * 360;
        this.cdSeconds[slot] = secs > 0 ? (secs >= 1 ? String(Math.ceil(secs)) : secs.toFixed(1)) : '';
        if (ratio > 0) anyActive = true;
      }
      if (!anyActive) { clearInterval(this.cdInterval!); this.cdInterval = null; }
    }, 50);
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

  openGameSettings() {
    if (this.gameSettingsModal.isOpenModal()) {
      this.gameSettingsModal.close();
    } else {
      this.closeOtherOnSide('right', this.gameSettingsModal);
      this.gameSettingsModal.open(GameSettingsPageComponent, 'game-settings');
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
