import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';
import { GameSettingsPageComponent } from 'src/app/pages/game-settings/game-settings.page';
import { InventoryComponent } from '../inventory/inventory.component';
import { EquipmentComponent } from '../equipment/equipment.component';
import { SummonComponent } from '../summon/summon.component';
import { TownChestComponent } from '../town-chest/town-chest.component';
import { WorldMapPanelComponent } from '../world-map-panel/world-map-panel.component';
import { ProgressPanelComponent } from '../progress-panel/progress-panel.component';
import { ShopComponent } from '../shop/shop.component';
import { SkillDetailComponent } from '../skill-detail/skill-detail.component';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { AutoAttackService } from 'src/app/services/auto-attack.service';
import { NotificationBadgeService } from 'src/app/services/notification-badge.service';
import { UnlockService } from 'src/app/services/unlock.service';
import { SummonService } from 'src/app/services/summon.service';
import { WorldService } from 'src/app/services/world.service';
import { CityBuildService } from 'src/app/services/city-build.service';
import { AdminService } from 'src/app/services/admin.service';
import { GlobalTalentsService } from 'src/app/services/global-talents.service';
import { HudSkillSlotsService } from 'src/app/services/hud-skill-slots.service';
import { BuildPanelComponent } from '../build-panel/build-panel.component';
import { BuildShopComponent } from '../build-shop/build-shop.component';
import { ForgeComponent } from '../forge/forge.component';
import { GlobalTalentsComponent } from '../global-talents/global-talents.component';
import { MapChestWindowComponent } from '../map-chest-window/map-chest-window.component';

@Component({
  selector: 'app-footer-bar',
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss'],
  standalone: false
})
export class FooterBarComponent implements OnInit, OnDestroy {
  @ViewChild('gameSettingsModal') gameSettingsModal!: ModalContainerComponent;
  @ViewChild('inventoryModal')   inventoryModal!:   ModalContainerComponent;
  @ViewChild('equipmentModal')   equipmentModal!:   ModalContainerComponent;
  @ViewChild('summonModal')      summonModal!:      ModalContainerComponent;
  @ViewChild('chestModal')       chestModal!:       ModalContainerComponent;
  @ViewChild('skillDetailModal') skillDetailModal!: ModalContainerComponent;
  @ViewChild('worldMapModal')    worldMapModal!:    ModalContainerComponent;
  @ViewChild('progressModal')    progressModal!:    ModalContainerComponent;
  @ViewChild('shopModal')        shopModal!:        ModalContainerComponent;
  @ViewChild('buildModal')       buildModal!:       ModalContainerComponent;
  @ViewChild('buildShopModal')   buildShopModal!:   ModalContainerComponent;
  @ViewChild('forgeModal')       forgeModal!:       ModalContainerComponent;
  @ViewChild('globalTalentsModal') globalTalentsModal!: ModalContainerComponent;
  @ViewChild('mapChestModal')    mapChestModal!:    ModalContainerComponent;

  private detailSub:        Subscription;
  private closeSub:         Subscription;
  private sceneStartingSub: Subscription;
  private townChestSub:      Subscription;
  private townChestCloseSub: Subscription;
  private worldSub:          Subscription;
  private placementSub:      Subscription;
  private moveModeSub:       Subscription;
  private deleteModeSub:     Subscription;
  private openWindowSub:     Subscription;
  private closeWindowSub:    Subscription;
  private inventoryOpenedByChest = false;
  private inventoryOpenedByShop = false;
  private inventoryOpenedByForge = false;

  /** Candado: false = modo edición de habilidades del HUD (skillEquip.hudEditMode). */
  locked = true;
  /** ¿Hay alguna habilidad equipada en una ranura del HUD VISIBLE (su talento global
   *  attack_2/3/4 desbloqueado)? El candado (editar HUD) solo tiene sentido si hay algo
   *  que editar; una skill en una ranura oculta no cuenta. */
  get hasHudSkill(): boolean {
    return this.hudSlots.slots.some((s, i) =>
      !!s && this.globalTalents.isUnlocked(GlobalTalentsService.SKILL_SLOT_NODES[i]));
  }
  /** Hub de botones (abajo-izquierda): abierto por defecto; el tirador lo colapsa. */
  hubOpen = true;
  /** Id del mapa actual: el botón de construir solo aparece en 'hogar'. */
  currentMapId = 'hogar';

  private skillEquipService      = inject(SkillEquipService);
  private playerBridge           = inject(PlayerBridgeService);
  autoAttack                     = inject(AutoAttackService);
  badges                         = inject(NotificationBadgeService);
  unlocks                        = inject(UnlockService);
  private summonService          = inject(SummonService);
  private worldService           = inject(WorldService);
  private cityBuild              = inject(CityBuildService);
  admin                          = inject(AdminService);
  private globalTalents          = inject(GlobalTalentsService);
  private hudSlots               = inject(HudSkillSlotsService);

  /** Auto-ataque desbloqueado (mejora de cuenta attack_1): gatea el FAB ∞ del HUD. */
  readonly autoAttackUnlocked$ = this.globalTalents.autoAttackUnlocked$;
  private autoAttackLockSub?: Subscription;

  /** Modo Mundo (runner): oculta el toggle de página del footer. */
  readonly runMode$ = this.playerBridge.runMode$;
  private runModeSub: Subscription;

  /** Modal "Has muerto" (Modo Mundo): al aceptar te lleva a la capital del planeta. */
  runDeadOpen = false;
  private runDeathSub?: Subscription;
  private closeMenusSub?: Subscription;

  constructor() { }

  // ── Muerte en el Modo Mundo ─────────────────────────────────────────────────
  acceptDeath(): void {
    this.runDeadOpen = false;
    this.playerBridge.requestExitRun();   // reanuda, resetea progreso y va a la capital
  }

  ngOnInit() {
    // Al entrar al runner, volver a la página principal (el toggle se oculta, así que
    // no debe quedarse atascado en la página de skills).
    this.runModeSub = this.runMode$.subscribe(active => {
      if (!active) {
        // Al salir del Modo Mundo (volver a la ciudad), cerrar el modal de muerte:
        // su backdrop (z-index 9999) taparía la ciudad e impediría abrir cualquier menú.
        this.runDeadOpen = false;
      }
    });
    // Muerte en el Modo Mundo → modal "Has muerto".
    this.runDeathSub = this.playerBridge.runDeath$.subscribe(() => { this.runDeadOpen = true; });
    // Modo Mundo: tocar la pantalla cierra todos los paneles del footer.
    this.closeMenusSub = this.playerBridge.closeMenusRequest$.subscribe(() => this.closeAllPanels());
    this.detailSub = this.skillEquipService.openDetail$.subscribe(() => {
      this.closeOtherOnSide('left', this.skillDetailModal);
      const fromHud = (this.skillEquipService.activeSlot ?? 0) < 0;
      this.skillDetailModal.persistent = fromHud;
      this.skillDetailModal.open(SkillDetailComponent, 'skill-detail');
    });
    this.closeSub = this.skillEquipService.closeSkillPanels$.subscribe(() => {
      if (this.skillDetailModal?.isOpenModal()) this.skillDetailModal.close();
      this.skillEquipService.activeSlot       = null;
      this.skillEquipService.selectedAbilityId = null;
    });
    this.townChestSub = this.summonService.townChestOpen$.subscribe((chestId) => {
      if (!this.chestModal?.isOpenModal()) this.openChest(chestId);
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

    // Pulsar un edificio con ventana en el mapa (la tienda, las estaciones de oficio…)
    // la abre a la izquierda. La tienda tiene su ventana propia; el resto de estaciones
    // (fragua, fundición…) abren de momento el mismo menú de forja (vacío).
    this.openWindowSub = this.cityBuild.openWindow$.subscribe(type => {
      if (type === 'shop')           this.openBuildShop();
      else if (type === 'mapChest')  this.openMapChestWindow();
      else                           this.openForge();
    });

    // La escena pide cerrar la ventana del edificio (jugador se alejó de la tienda/fragua).
    this.closeWindowSub = this.cityBuild.closeWindow$.subscribe(() => {
      if (this.buildShopModal?.isOpenModal()) this.buildShopModal.close();
      if (this.forgeModal?.isOpenModal())     this.forgeModal.close();
      if (this.mapChestModal?.isOpenModal())  this.mapChestModal.close();
    });

    // Si el auto-ataque NO está desbloqueado (mejora de cuenta), apágalo: el FAB
    // desaparece del HUD y no debe seguir activo por debajo.
    this.autoAttackLockSub = this.autoAttackUnlocked$.subscribe(unlocked => {
      if (!unlocked) this.autoAttack.isEnabled = false;
    });

    this.sceneStartingSub = this.playerBridge.sceneStarting$.subscribe(() => {
      this.locked = true;
      this.skillEquipService.hudEditMode       = false;
      this.skillEquipService.activeSlot        = null;
      this.skillEquipService.selectedAbilityId = null;
    });
  }

  ngOnDestroy() {
    this.runModeSub?.unsubscribe();
    this.runDeathSub?.unsubscribe();
    this.closeMenusSub?.unsubscribe();
    this.detailSub?.unsubscribe();
    this.closeSub?.unsubscribe();
    this.sceneStartingSub?.unsubscribe();
    this.townChestSub?.unsubscribe();
    this.townChestCloseSub?.unsubscribe();
    this.worldSub?.unsubscribe();
    this.placementSub?.unsubscribe();
    this.moveModeSub?.unsubscribe();
    this.deleteModeSub?.unsubscribe();
    this.openWindowSub?.unsubscribe();
    this.closeWindowSub?.unsubscribe();
    this.autoAttackLockSub?.unsubscribe();
  }

  private closeOtherOnSide(side: 'left' | 'right', except: ModalContainerComponent) {
    const groups: Record<'left' | 'right', ModalContainerComponent[]> = {
      left:  [this.summonModal, this.chestModal, this.equipmentModal, this.skillDetailModal, this.worldMapModal, this.buildModal, this.buildShopModal, this.forgeModal, this.globalTalentsModal, this.mapChestModal],
      right: [this.gameSettingsModal, this.inventoryModal, this.worldMapModal, this.progressModal, this.shopModal],
    };
    groups[side].forEach(m => { if (m !== except && m?.isOpenModal()) m.close(); });
  }

  /** Cierra todas las ventanas/paneles del footer (ambos lados, incl. persistentes). */
  private closeAllPanels() {
    [this.gameSettingsModal, this.inventoryModal, this.equipmentModal,
     this.summonModal, this.chestModal, this.skillDetailModal,
     this.worldMapModal, this.progressModal, this.shopModal, this.buildModal, this.buildShopModal, this.forgeModal, this.globalTalentsModal, this.mapChestModal]
      .forEach(m => { if (m?.isOpenModal()) m.close(); });
  }

  toggleHub() { this.hubOpen = !this.hubOpen; }

  toggleAutoAttack() {
    this.autoAttack.toggle();
  }

  /** Candado: alterna entre USAR (locked) y EDITAR (unlocked) las habilidades del HUD.
   *  En modo editar, hudEditMode = true → los 3 botones de habilidad permiten asignar. */
  toggleLock() {
    this.locked = !this.locked;
    this.skillEquipService.hudEditMode = !this.locked;
    if (this.locked) {
      if (this.skillDetailModal?.isOpenModal()) this.skillDetailModal.close();
      this.skillEquipService.closeSkillPanels$.next();
      this.skillEquipService.activeSlot        = null;
      this.skillEquipService.selectedAbilityId = null;
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

  openChest(chestId: string) {
    if (this.chestModal.isOpenModal()) {
      this.chestModal.close();
    } else {
      this.closeOtherOnSide('left', this.chestModal);
      // Fijar el ID ANTES de abrir: TownChestComponent lo lee en su ngOnInit para
      // saber qué almacén cargar (solo hay una ventana de cofre abierta a la vez).
      this.summonService.townChestIsOpen$.next(chestId);
      this.chestModal.open(TownChestComponent, 'town-chest');
    }
  }

  onChestModalClosed() {
    this.summonService.townChestIsOpen$.next(null);
  }

  onBuildShopModalClosed() {
    this.cityBuild.windowOpen$.next(false);
    // Cierra el inventario si se abrió junto a la tienda.
    if (this.inventoryOpenedByShop && this.inventoryModal?.isOpenModal()) {
      this.inventoryModal.close();
    }
    this.inventoryOpenedByShop = false;
  }

  onForgeModalClosed() {
    this.cityBuild.windowOpen$.next(false);
    // Cierra el inventario si se abrió junto a la fundición.
    if (this.inventoryOpenedByForge && this.inventoryModal?.isOpenModal()) {
      this.inventoryModal.close();
    }
    this.inventoryOpenedByForge = false;
  }

  /** Abre el menú de la fundición a la izquierda. Marca windowOpen$ para que la escena
   *  lo cierre al alejarte, y abre también el inventario (derecha) para arrastrar
   *  materiales/combustible y recoger la salida (igual que la tienda). */
  openForge() {
    if (this.forgeModal.isOpenModal()) {
      this.forgeModal.close();
    } else {
      this.closeOtherOnSide('left', this.forgeModal);
      this.forgeModal.open(ForgeComponent, 'forge');
      this.cityBuild.windowOpen$.next(true);
      if (!this.inventoryModal?.isOpenModal()) {
        this.openInventory();
        this.inventoryOpenedByForge = true;
      }
    }
  }

  onMapChestModalClosed() {
    this.cityBuild.windowOpen$.next(false);
  }

  /** Ventana del cofre central del mapa (izquierda). De momento placeholder. */
  openMapChestWindow() {
    if (this.mapChestModal.isOpenModal()) {
      this.mapChestModal.close();
    } else {
      this.closeOtherOnSide('left', this.mapChestModal);
      this.mapChestModal.open(MapChestWindowComponent, 'mapChest');
      this.cityBuild.windowOpen$.next(true);
    }
  }

  openBuild() {
    if (this.buildModal.isOpenModal()) {
      this.buildModal.close();
    } else {
      this.closeOtherOnSide('left', this.buildModal);
      this.buildModal.open(BuildPanelComponent, 'build');
    }
  }

  openBuildShop() {
    if (this.buildShopModal.isOpenModal()) {
      this.buildShopModal.close();
    } else {
      this.closeOtherOnSide('left', this.buildShopModal);
      this.buildShopModal.open(BuildShopComponent, 'build-shop');
      this.cityBuild.windowOpen$.next(true);
      // Abre también el inventario (a la derecha) para gestionar lo comprado.
      if (!this.inventoryModal?.isOpenModal()) {
        this.openInventory();
        this.inventoryOpenedByShop = true;
      }
    }
  }

  /** Botón "abrir tienda" (minimapa): acceso GLOBAL a la tienda construible real.
   *  Abre la misma ventana que el edificio, pero SIN marcar windowOpen$ (no se cierra
   *  al alejarse: la proximidad solo aplica al abrirla desde el edificio/espacio). */
  openShop() {
    if (this.buildShopModal.isOpenModal()) {
      this.buildShopModal.close();
    } else {
      this.closeOtherOnSide('left', this.buildShopModal);
      this.buildShopModal.open(BuildShopComponent, 'build-shop');
      if (!this.inventoryModal?.isOpenModal()) {
        this.openInventory();
        this.inventoryOpenedByShop = true;
      }
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

  /** Talentos globales de la cuenta: panel izquierdo (de momento solo el nivel total). */
  openGlobalTalents() {
    if (this.globalTalentsModal.isOpenModal()) {
      this.globalTalentsModal.close();
    } else {
      this.closeOtherOnSide('left', this.globalTalentsModal);
      this.globalTalentsModal.open(GlobalTalentsComponent, 'global-talents');
    }
  }
}
