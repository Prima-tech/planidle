import { Component, ElementRef, inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import Phaser from 'phaser';
import { TalentTreeScene, TALENT_TREE_DATA_KEY, TALENT_SERVICE_KEY, TALENT_NODE_TAP_KEY, TALENT_TREE_RES } from 'src/app/scenes/talent-tree.scene';
import { EquipmentService, EquipmentSlot } from 'src/app/services/equipment.service';
import { GatheringEquipmentService, GatheringSlot } from 'src/app/services/gathering-equipment.service';
import { InventoryItem, InventoryService } from 'src/app/services/inventory.service';
import { CharacterStatsService, BaseStats, DefenseBreakdown, EvasionBreakdown, CritChanceBreakdown, CritDamageBreakdown, MagicDamageBreakdown, RegenBreakdown, DropRateBreakdown } from 'src/app/services/character-stats.service';
import { PlayerStateService, expNeeded, MAX_LEVEL } from 'src/app/services/player-state.service';
import { TalentService, TalentNodeConfig, SphereType, SPHERE_MULT, TALENT_NODES } from 'src/app/services/talent.service';
import { PanelStateService } from 'src/app/services/panel-state.service';
import { NotificationBadgeService } from 'src/app/services/notification-badge.service';
import { AchievementService, AchievementDef, AchievementScope } from 'src/app/services/achievement.service';

@Component({
  selector: 'app-equipment',
  templateUrl: './equipment.component.html',
  styleUrls: ['./equipment.component.scss'],
  standalone: false,
})
export class EquipmentComponent implements OnInit, OnDestroy {

  private panelState = inject(PanelStateService);
  private el = inject(ElementRef);
  private ngZone = inject(NgZone);
  badges = inject(NotificationBadgeService);
  achievements = inject(AchievementService);

  private _activeTab = 0;
  get activeTab(): number { return this._activeTab; }
  set activeTab(v: number) {
    this._activeTab = v;
    this.panelState.set('equip.tab', v);
    if (v === 3) {
      // El contenedor entra al DOM con el *ngIf en este mismo ciclo
      setTimeout(() => this.createTalentGame());
    } else {
      this.destroyTalentGame();
    }
    if (v === 4) this.initPan();
    if (v !== 3 && v !== 4) {
      this.selectedNodeId = null;
      this.talentExpanded = false;
    }
    if (v !== 0) this.statsFlyoutOpen = false;
    if (v !== 5) this.selectedAch = null;
  }

  showAtkBreakdown      = false;
  showMagicAtkBreakdown = false;
  showDropBreakdown     = false;
  readonly damage$       = this.charStats.damage$;
  readonly magicDamage$  = this.charStats.magicDamage$;
  readonly freePoints$   = this.charStats.freePoints$;
  readonly hpRegen$      = this.charStats.hpRegen$;
  readonly mpRegen$      = this.charStats.mpRegen$;
  readonly dropRate$     = this.charStats.dropRate$;
  readonly hp$      = this.charStats.hp$;
  readonly mp$      = this.charStats.mp$;
  readonly defense$ = this.charStats.defense$;
  readonly evasion$    = this.charStats.evasion$;
  readonly critChance$ = this.charStats.critChance$;
  readonly critDamage$ = this.charStats.critDamage$;
  showHpBreakdown       = false;
  showMpBreakdown       = false;
  showDefBreakdown      = false;
  showEvasionBreakdown  = false;
  showCritBreakdown     = false;
  readonly expNeeded = expNeeded;
  readonly maxLevel  = MAX_LEVEL;

  readonly slotPlaceholderIcons: Record<string, string> = {
    helmet:   'skull-outline',
    armor:    'shirt-outline',
    pants:    'man-outline',
    boots:    'footsteps-outline',
    weapon:   'hammer-outline',
    necklace: 'link-outline',
    ring1:    'diamond-outline',
    ring2:    'diamond-outline',
    food:     'restaurant-outline',
    potion:   'flask-outline',
  };

  readonly gatheringPlaceholderIcons: Record<string, string> = {
    pickaxe:     'hammer-outline',
    axe:         'cut-outline',
    fishing_rod: 'fish-outline',
    shovel:      'trail-sign-outline',
    lantern:     'sunny-outline',
    backpack:    'bag-handle-outline',
    gloves:      'hand-left-outline',
    belt:        'link-outline',
    compass:     'compass-outline',
    torch:       'flame-outline',
  };

  readonly loadoutIndices = [0, 1, 2];

  switchLoadout(index: number): void {
    this.equipmentService.switchLoadout(index);
    this.gatheringService.switchLoadout(index);
  }

  // ── Logros (tab 4) ───────────────────────────────────────────────────────────

  achScope: AchievementScope = 'char';
  selectedAch: AchievementDef | null = null;

  setAchScope(scope: AchievementScope): void {
    this.achScope = scope;
    this.selectedAch = null;
  }

  selectAch(a: AchievementDef): void {
    this.selectedAch = this.selectedAch?.id === a.id ? null : a;
  }

  // Flyout de stats (tab 0): se abre al pinchar la pastilla, a la derecha del panel
  statsFlyoutOpen = false;

  toggleStatsFlyout(): void {
    this.statsFlyoutOpen = !this.statsFlyoutOpen;
    // Al abrirla ya has "visto" el punto nuevo: se apaga el badge
    if (this.statsFlyoutOpen) this.badges.clear('equip.stats');
  }

  readonly statsList: { key: keyof BaseStats; label: string }[] = [
    { key: 'STR',   label: 'STR' },
    { key: 'CONST', label: 'VIT' },
    { key: 'DEX',   label: 'DEX' },
    { key: 'INT',   label: 'INT' },
    { key: 'MAG',   label: 'MAG' },
    { key: 'CHR',   label: 'CHR' },
  ];

  // ── Talentos ─────────────────────────────────────────────────────────────────

  readonly talentTrees: { label: string; icon: string; nodes: TalentNodeConfig[] }[] = [
    { label: 'Combate', icon: 'shield-half-outline',  nodes: TALENT_NODES },
  ];

  private _activeTalentTree = 0;
  get activeTalentTree(): number { return this._activeTalentTree; }
  set activeTalentTree(v: number) {
    this._activeTalentTree = v;
    this.selectedNodeId = null;
    this.recreateTalentGame();
    if (this._activeTab === 3) this.initPan();
  }

  // ── Árbol HTML clásico (tab 4) ───────────────────────────────────────────────

  private initPan(): void {
    this.classicZoom = 1;
    this.classicZoomedOut = false;
    const nodes = this.activeTreeNodes;
    const root = nodes.find(n => n.requires.length === 0) ?? nodes[0];
    if (!root) { this.panX = 0; this.panY = 0; return; }
    this.panX = 113 - (root.col * 33 + 16);  // centra X en viewport 226px
    this.panY = 100 - (root.row * 48 + 22);  // nodo raíz a ~38% desde arriba
  }

  // Zoom del árbol clásico: '+' encaja el árbol completo, '−' vuelve al hub
  classicZoom = 1;
  classicZoomedOut = false;

  toggleClassicZoom(viewport: HTMLElement): void {
    this.classicZoomedOut = !this.classicZoomedOut;
    if (this.classicZoomedOut) {
      const s = Math.min(
        viewport.clientWidth  / this.canvasWidth,
        viewport.clientHeight / this.canvasHeight,
      );
      this.classicZoom = s;
      this.panX = (viewport.clientWidth  - this.canvasWidth  * s) / 2;
      this.panY = (viewport.clientHeight - this.canvasHeight * s) / 2;
    } else {
      this.initPan();
    }
  }

  panX = 0;
  panY = 0;
  get panActive(): boolean { return this._panActive; }
  private _panActive = false;
  private _panStartClientX = 0;
  private _panStartClientY = 0;
  private _panStartPanX = 0;
  private _panStartPanY = 0;
  panMoved = false;

  get canvasWidth(): number {
    const nodes = this.activeTreeNodes;
    if (!nodes.length) return 220;
    return (Math.max(...nodes.map(n => n.col)) + 1) * 33 + 33;
  }

  get canvasHeight(): number {
    const nodes = this.activeTreeNodes;
    if (!nodes.length) return 200;
    return (Math.max(...nodes.map(n => n.row)) + 1) * 48 + 48;
  }

  onCanvasPointerDown(e: PointerEvent): void {
    this._panActive = true;
    this.panMoved = false;
    this._panStartClientX = e.clientX;
    this._panStartClientY = e.clientY;
    this._panStartPanX = this.panX;
    this._panStartPanY = this.panY;
  }

  onCanvasPointerMove(e: PointerEvent): void {
    if (!this._panActive) return;
    const dx = e.clientX - this._panStartClientX;
    const dy = e.clientY - this._panStartClientY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.panMoved = true;
    if (this.panMoved) {
      this.panX = this._panStartPanX + dx;
      this.panY = this._panStartPanY + dy;
    }
  }

  onCanvasPointerUp(): void {
    this._panActive = false;
  }

  get treeLines(): { x1: number; y1: number; x2: number; y2: number; active: boolean }[] {
    const nodes = this.activeTreeNodes;
    const CW = 33, CH = 48;
    const cx = (col: number) => col * CW + CW / 2;
    const cy = (row: number) => row * CH + 21;
    return nodes.flatMap(node =>
      node.requires
        .map(reqId => {
          const parent = nodes.find(n => n.id === reqId);
          if (!parent) return null;
          return {
            x1: cx(parent.col), y1: cy(parent.row),
            x2: cx(node.col),   y2: cy(node.row),
            active: !!this.talent.slotted[reqId] && !!this.talent.slotted[node.id],
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null)
    );
  }

  nodeState(node: TalentNodeConfig): 'locked' | 'available' | 'slotted' {
    if (!this.talent.isUnlocked(node.id)) return 'locked';
    if (this.talent.slotted[node.id])     return 'slotted';
    return 'available';
  }

  nodeStyle(node: TalentNodeConfig): Record<string, string> {
    return { left: `${node.col * 33 + 3}px`, top: `${node.row * 48 + 3}px` };
  }

  nodeColor(node: TalentNodeConfig): string {
    const sphere = this.talent.slotted[node.id];
    return sphere ? this.sphereColors[sphere] : '';
  }

  onNodeClick(node: TalentNodeConfig): void {
    if (this.panMoved) return;
    if (!this.talent.isUnlocked(node.id)) return;
    this.selectedNodeId = this.selectedNodeId === node.id ? null : node.id;
  }

  get activeTreeNodes(): TalentNodeConfig[] {
    return this.talentTrees[this._activeTalentTree]?.nodes ?? [];
  }

  selectedNodeId: string | null = null;

  readonly sphereTypes: SphereType[] = ['normal', 'rare', 'epic'];

  readonly sphereColors: Record<SphereType, string> = {
    normal: '#4caf50',
    rare:   '#2196f3',
    epic:   '#9c27b0',
  };

  readonly sphereLabels: Record<SphereType, string> = {
    normal: 'N', rare: 'R', epic: 'E',
  };

  get selectedNode(): TalentNodeConfig | null {
    return this.talent.nodes.find(n => n.id === this.selectedNodeId) ?? null;
  }

  get talentBonus() { return this.talent.getBonus(); }

  private _talentExpanded = false;
  get talentExpanded(): boolean { return this._talentExpanded; }
  set talentExpanded(v: boolean) {
    this._talentExpanded = v;
    const modal = this.el.nativeElement.closest('.modal-window') as HTMLElement;
    if (modal) modal.style.bottom = v ? '10px' : '';
    // El cambio de tamaño del viewport lo recoge el ResizeObserver del juego
  }

  // ── Árbol Phaser ─────────────────────────────────────────────────────────────

  private talentGame: Phaser.Game | null = null;
  private talentResizeObs: ResizeObserver | null = null;
  // Mismo factor de supersampling que usa la escena para sus medidas
  private readonly talentDpr = TALENT_TREE_RES;

  private createTalentGame(): void {
    const parent = document.getElementById('talent-tree-view');
    if (!parent || this.talentGame) return;
    this.talentZoomedOut = false;   // la escena arranca siempre a zoom 1
    // El modal puede no haber asentado su layout aún: reintenta hasta tener tamaño
    if (!parent.clientWidth || !parent.clientHeight) {
      setTimeout(() => this.createTalentGame(), 50);
      return;
    }
    // Canvas a resolución nativa + zoom CSS inverso: texto nítido (ver world-map-panel)
    const dpr = this.talentDpr;
    this.talentGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width:  parent.clientWidth * dpr,
      height: parent.clientHeight * dpr,
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      // roundPixels: el texto centrado cae en medios píxeles y se emborrona sin esto
      render: { antialias: true, roundPixels: true },
      backgroundColor: '#0c0908',
      scene: [TalentTreeScene],
    });
    this.talentGame.registry.set(TALENT_TREE_DATA_KEY, this.activeTreeNodes);
    this.talentGame.registry.set(TALENT_SERVICE_KEY, this.talent);
    // El tap llega desde Phaser (fuera de Angular): ngZone.run para el picker
    this.talentGame.registry.set(TALENT_NODE_TAP_KEY, (nodeId: string) => {
      this.ngZone.run(() => this.onNodeTap(nodeId));
    });
    // El viewport cambia de tamaño al abrir el modal o al expandir el panel:
    // redimensiona el canvas en vez de recrear el juego
    this.talentResizeObs = new ResizeObserver(() => this.resizeTalentGame(parent));
    this.talentResizeObs.observe(parent);
  }

  private resizeTalentGame(parent: HTMLElement): void {
    if (!this.talentGame) return;
    const w = Math.round(parent.clientWidth  * this.talentDpr);
    const h = Math.round(parent.clientHeight * this.talentDpr);
    if (!w || !h) return;
    const scale = this.talentGame.scale;
    if (scale.width !== w || scale.height !== h) scale.resize(w, h);
  }

  private destroyTalentGame(): void {
    this.talentResizeObs?.disconnect();
    this.talentResizeObs = null;
    this.talentGame?.destroy(true);
    this.talentGame = null;
  }

  private recreateTalentGame(): void {
    if (this._activeTab !== 3) return;
    this.destroyTalentGame();
    // Espera a que el layout asiente el nuevo tamaño del viewport
    setTimeout(() => this.createTalentGame(), 60);
  }

  private syncTalentSelection(): void {
    const scene = this.talentGame?.scene.getScene('TalentTreeScene') as TalentTreeScene | undefined;
    scene?.setSelected(this.selectedNodeId);
  }

  // Zoom del árbol Phaser: '+' aleja (árbol completo), '−' vuelve al hub
  talentZoomedOut = false;

  toggleTalentZoom(): void {
    this.talentZoomedOut = !this.talentZoomedOut;
    const scene = this.talentGame?.scene.getScene('TalentTreeScene') as TalentTreeScene | undefined;
    scene?.setZoomedOut(this.talentZoomedOut);
  }

  private onNodeTap(nodeId: string): void {
    this.selectedNodeId = this.selectedNodeId === nodeId ? null : nodeId;
    this.syncTalentSelection();
  }

  clearTalentSelection(): void {
    this.selectedNodeId = null;
    this.syncTalentSelection();
  }

  slotSphere(sphere: SphereType): void {
    if (!this.selectedNodeId) return;
    this.talent.slot(this.selectedNodeId, sphere);
    this.clearTalentSelection();
  }

  canUnslotSelected(): boolean {
    return !!this.selectedNodeId &&
           !!this.talent.slotted[this.selectedNodeId] &&
           !this.talent.hasDependents(this.selectedNodeId);
  }

  unslotSelected(): void {
    if (this.selectedNodeId) this.talent.unslot(this.selectedNodeId);
    this.clearTalentSelection();
  }

  nodeEffectLabel(node: TalentNodeConfig, sphere: SphereType): string {
    const val = node.effect.base * SPHERE_MULT[sphere];
    switch (node.effect.type) {
      case 'hp':         return `+${val} HP`;
      case 'mp':         return `+${val} MP`;
      case 'defense':    return `+${val} DEF`;
      case 'critChance': return `+${val}% CRIT`;
      case 'hpRegen':    return `+${val} HP/regen`;
      case 'mpRegen':    return `+${val} MP/regen`;
      case 'dropRate':   return `+${val}% DROP`;
      default:           return `+${val} ATK`;
    }
  }

  formatNodeLabel(node: TalentNodeConfig): string {
    return node.label.replace('\n', ' ');
  }

  constructor(
    public equipmentService: EquipmentService,
    public gatheringService: GatheringEquipmentService,
    private inventoryService: InventoryService,
    public charStats: CharacterStatsService,
    public playerState: PlayerStateService,
    public talent: TalentService,
  ) {}

  ngOnInit(): void {
    this._activeTab = this.panelState.get('equip.tab', 0);
    // Tab guardado fuera de rango (numeraciones antiguas) → al primero
    if (this._activeTab > 5) this._activeTab = 0;
    if (this._activeTab === 3) setTimeout(() => this.createTalentGame());
    if (this._activeTab === 4) this.initPan();
  }

  ngOnDestroy(): void {
    this.destroyTalentGame();
  }

  canDropInSlot = (drag: CdkDrag, drop: CdkDropList): boolean => {
    return this.equipmentService.canEquip(drag.data?.item, drop.id);
  };

  canDropInGatheringSlot = (drag: CdkDrag, drop: CdkDropList): boolean => {
    return this.gatheringService.canEquip(drag.data?.item, drop.id);
  };

  onGatheringDrop(event: CdkDragDrop<any>, slot: GatheringSlot): void {
    const data = event.item.data;
    const item: InventoryItem = data.item;
    if (!this.gatheringService.canEquip(item, `gather-${slot.id}`)) return;
    const displaced = this.gatheringService.equip(`gather-${slot.id}`, item);
    if (data.sourceContext === 'inventory') {
      this.inventoryService.removeRequest$.next({ tabIndex: data.tabIndex, row: data.row, col: data.col });
      if (displaced) this.inventoryService.itemDropped$.next(displaced);
    }
  }

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

  getSheetPos(frame: number = 0, cols: number = 12, frameSize: number = 32, contentSize?: number): string {
    const cs    = contentSize ?? frameSize;
    const scale = 32 / cs;
    const col   = frame % cols;
    const row   = Math.floor(frame / cols);
    return `-${col * frameSize * scale}px -${row * frameSize * scale}px`;
  }

  getSheetBgSize(cols: number = 12, frameSize: number = 32, contentSize?: number): string {
    const cs = contentSize ?? frameSize;
    return `${cols * frameSize * (32 / cs)}px auto`;
  }
}
