import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';
import { SettingsPageComponent } from 'src/app/pages/settings/settings.page';
import { GameSettingsPageComponent } from 'src/app/pages/game-settings/game-settings.page';
import { InventoryComponent } from '../inventory/inventory.component';
import { EquipmentComponent } from '../equipment/equipment.component';
import { SummonComponent } from '../summon/summon.component';
import { TownChestComponent } from '../town-chest/town-chest.component';
import { SkillSlotsPanelComponent } from '../skill-slots-panel/skill-slots-panel.component';
import { WorldMapPanelComponent } from '../world-map-panel/world-map-panel.component';
import { ProgressPanelComponent } from '../progress-panel/progress-panel.component';
import { ShopComponent } from '../shop/shop.component';
import { SkillDetailComponent } from '../skill-detail/skill-detail.component';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { TalentService, SPHERE_MULT } from 'src/app/services/talent.service';
import { SkillActivationService } from 'src/app/services/skill-activation.service';
import { SKILL_REGISTRY } from 'src/app/services/skill-config';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { AutoAttackService } from 'src/app/services/auto-attack.service';
import { NotificationBadgeService } from 'src/app/services/notification-badge.service';
import { UnlockService } from 'src/app/services/unlock.service';
import { SummonService } from 'src/app/services/summon.service';
import { WorldService } from 'src/app/services/world.service';
import { CityBuildService } from 'src/app/services/city-build.service';
import { BuildPanelComponent } from '../build-panel/build-panel.component';

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
  @ViewChild('summonModal')      summonModal!:      ModalContainerComponent;
  @ViewChild('chestModal')       chestModal!:       ModalContainerComponent;
  @ViewChild('skillSlotsModal')  skillSlotsModal!:  ModalContainerComponent;
  @ViewChild('skillDetailModal') skillDetailModal!: ModalContainerComponent;
  @ViewChild('worldMapModal')    worldMapModal!:    ModalContainerComponent;
  @ViewChild('progressModal')    progressModal!:    ModalContainerComponent;
  @ViewChild('shopModal')        shopModal!:        ModalContainerComponent;
  @ViewChild('buildModal')       buildModal!:       ModalContainerComponent;

  private detailSub:        Subscription;
  private closeSub:         Subscription;
  private activateSub:      Subscription;
  private sceneStartingSub: Subscription;
  private townChestSub:      Subscription;
  private townChestCloseSub: Subscription;
  private worldSub:          Subscription;
  private placementSub:      Subscription;
  private moveModeSub:       Subscription;
  private deleteModeSub:     Subscription;
  private inventoryOpenedByChest = false;
  private cdInterval:       ReturnType<typeof setInterval> | null = null;

  page: 'main' | 'skills' = 'main';
  activeSkillSlot: number | null = null;
  locked = true;
  /** Id del mapa actual: el botón de construir solo aparece en 'hogar'. */
  currentMapId = 'hogar';

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
  badges                         = inject(NotificationBadgeService);
  unlocks                        = inject(UnlockService);
  private summonService          = inject(SummonService);
  private worldService           = inject(WorldService);
  private cityBuild              = inject(CityBuildService);

  constructor() { }

  ngOnInit() {
    this.detailSub = this.skillEquipService.openDetail$.subscribe(() => {
      this.closeOtherOnSide('left', this.skillDetailModal);
      const fromHud = (this.skillEquipService.activeSlot ?? 0) < 0;
      this.skillDetailModal.persistent = fromHud;
      this.skillDetailModal.open(SkillDetailComponent, 'skill-detail');
    });
    this.closeSub = this.skillEquipService.closeSkillPanels$.subscribe(() => {
      if (this.skillDetailModal?.isOpenModal()) this.skillDetailModal.close();
      if (this.skillSlotsModal?.isOpenModal())  this.skillSlotsModal.close();
      this.activeSkillSlot = null;
      this.skillEquipService.activeSlot       = null;
      this.skillEquipService.selectedAbilityId = null;
    });
    this.townChestSub = this.summonService.townChestOpen$.subscribe(() => {
      if (!this.chestModal?.isOpenModal()) this.openChest();
      if (!this.inventoryModal?.isOpenModal()) {
        this.openInventory();
        this.inventoryOpenedByChest = true;
      }
    });

    this.townChestCloseSub = this.summonService.townChestCloseRequest$.subscribe(() => {
      if (this.chestModal?.isOpenModal()) this.chestModal.close();
      if (this.inventoryOpenedByChest && this.inventoryModal?.isOpenModal()) {
        this.inventoryModal.close();
      }
      this.inventoryOpenedByChest = false;
    });

    this.worldSub = this.worldService.currentMap$.subscribe(map => {
      this.currentMapId = map.id;
      // Al salir de la ciudad: cierra el panel y cancela cualquier colocación en curso.
      if (map.id !== 'hogar') {
        if (this.buildModal?.isOpenModal()) this.buildModal.close();
        this.cityBuild.cancelPlacement();
        this.cityBuild.cancelMoveMode();
        this.cityBuild.cancelDeleteMode();
        this.cityBuild.cancelDelete();
      }
    });

    // Al seleccionar un construible, cierra TODAS las ventanas para colocar el
    // ghost sin paneles de por medio (el ghost ya vive en Phaser).
    this.placementSub = this.cityBuild.placementMode$.subscribe(def => {
      if (def) this.closeAllPanels();
    });

    // Al entrar en "mover edificio", cierra todas las ventanas para poder pinchar
    // un edificio del mapa sin paneles de por medio.
    this.moveModeSub = this.cityBuild.moveMode$.subscribe(active => {
      if (active) this.closeAllPanels();
    });

    // Igual al entrar en "borrar edificio": cierra las ventanas para pinchar el mapa.
    this.deleteModeSub = this.cityBuild.deleteMode$.subscribe(active => {
      if (active) this.closeAllPanels();
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
    this.townChestSub?.unsubscribe();
    this.townChestCloseSub?.unsubscribe();
    this.worldSub?.unsubscribe();
    this.placementSub?.unsubscribe();
    this.moveModeSub?.unsubscribe();
    this.deleteModeSub?.unsubscribe();
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
      left:  [this.summonModal, this.chestModal, this.equipmentModal, this.skillDetailModal, this.worldMapModal, this.buildModal],
      right: [this.menuModal, this.gameSettingsModal, this.inventoryModal, this.skillSlotsModal, this.worldMapModal, this.progressModal, this.shopModal],
    };
    groups[side].forEach(m => { if (m !== except && m?.isOpenModal()) m.close(); });
  }

  /** Cierra todas las ventanas/paneles del footer (ambos lados, incl. persistentes). */
  private closeAllPanels() {
    [this.menuModal, this.gameSettingsModal, this.inventoryModal, this.equipmentModal,
     this.summonModal, this.chestModal, this.skillSlotsModal, this.skillDetailModal,
     this.worldMapModal, this.progressModal, this.shopModal, this.buildModal]
      .forEach(m => { if (m?.isOpenModal()) m.close(); });
  }

  toggleAutoAttack() {
    this.autoAttack.toggle();
  }

  toggleAutoSkills() {
    this.autoAttack.toggleSkills();
  }

  togglePage() {
    if (this.page === 'main') {
      [this.menuModal, this.inventoryModal, this.equipmentModal,
       this.summonModal, this.chestModal, this.worldMapModal, this.progressModal, this.buildModal]
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
    this.skillEquipService.hudEditMode = !this.locked;
    if (this.locked) {
      if (this.skillSlotsModal?.isOpenModal())  this.skillSlotsModal.close();
      if (this.skillDetailModal?.isOpenModal()) this.skillDetailModal.close();
      this.skillEquipService.closeSkillPanels$.next();
      this.activeSkillSlot = null;
      this.skillEquipService.activeSlot        = null;
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

  openWorldMap() {
    if (this.worldMapModal.isOpenModal()) {
      this.worldMapModal.close();
    } else {
      // Ocupa todo el ancho: cierra los paneles de ambos lados
      this.closeOtherOnSide('left',  this.worldMapModal);
      this.closeOtherOnSide('right', this.worldMapModal);
      this.worldMapModal.open(WorldMapPanelComponent, 'world-map');
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

  openChest() {
    if (this.chestModal.isOpenModal()) {
      this.chestModal.close();
    } else {
      this.closeOtherOnSide('left', this.chestModal);
      this.chestModal.open(TownChestComponent, 'town-chest');
      this.summonService.townChestIsOpen$.next(true);
    }
  }

  onChestModalClosed() {
    this.summonService.townChestIsOpen$.next(false);
  }

  openBuild() {
    if (this.buildModal.isOpenModal()) {
      this.buildModal.close();
    } else {
      this.closeOtherOnSide('left', this.buildModal);
      this.buildModal.open(BuildPanelComponent, 'build');
    }
  }

  openShop() {
    if (this.shopModal.isOpenModal()) {
      this.shopModal.close();
    } else {
      this.closeOtherOnSide('right', this.shopModal);
      this.shopModal.open(ShopComponent, 'shop');
    }
  }

  openProgress() {
    if (this.progressModal.isOpenModal()) {
      this.progressModal.close();
    } else {
      this.closeOtherOnSide('right', this.progressModal);
      this.progressModal.open(ProgressPanelComponent, 'progress');
    }
  }
}
