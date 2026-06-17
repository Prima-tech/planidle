import { Component, ElementRef, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { EquipmentService, EquipmentSlot } from 'src/app/services/equipment.service';
import { GatheringEquipmentService, GatheringSlot } from 'src/app/services/gathering-equipment.service';
import { GatheringSkillsService, GATHERING_SKILLS, GatheringSkillId } from 'src/app/services/gathering-skills.service';
import { InventoryItem, InventoryService } from 'src/app/services/inventory.service';
import { CharacterStatsService, BaseStats, DefenseBreakdown, EvasionBreakdown, CritChanceBreakdown, CritDamageBreakdown, MagicDamageBreakdown, RegenBreakdown, DropRateBreakdown } from 'src/app/services/character-stats.service';
import { PlayerStateService, expNeeded, MAX_LEVEL } from 'src/app/services/player-state.service';
import { TalentService, TalentNodeConfig, SphereType, SPHERE_MULT, TALENT_NODES } from 'src/app/services/talent.service';
import { SKILL_REGISTRY } from 'src/app/services/skill-config';
import { AdminService } from 'src/app/services/admin.service';
import { PanelStateService } from 'src/app/services/panel-state.service';
import { EquipmentPanelService } from 'src/app/services/equipment-panel.service';
import { NotificationBadgeService } from 'src/app/services/notification-badge.service';
import { AchievementService, AchievementDef, AchievementScope } from 'src/app/services/achievement.service';
import { QuestService, QuestDef } from 'src/app/services/quest.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { AsgardService } from 'src/app/services/asgard';
import { ICONS1, ICONS1_COLS, ICONS1_FRAME_SIZE } from 'src/assets/icon/icons/icons1';

@Component({
  selector: 'app-equipment',
  templateUrl: './equipment.component.html',
  styleUrls: ['./equipment.component.scss'],
  standalone: false,
})
export class EquipmentComponent implements OnInit, OnDestroy {

  private panelState = inject(PanelStateService);
  private equipPanel = inject(EquipmentPanelService);
  private el = inject(ElementRef);
  badges = inject(NotificationBadgeService);
  achievements = inject(AchievementService);
  quests = inject(QuestService);
  private playerBridge = inject(PlayerBridgeService);
  private asgard = inject(AsgardService);
  admin = inject(AdminService);

  // Cooldown de la poción auto-equipada (overlay sobre el slot)
  potionCdActive = false;
  potionCdRatio = 1;
  potionCdSeconds = 0;
  private potionCdInterval: any;

  private _activeTab = 0;
  get activeTab(): number { return this._activeTab; }
  set activeTab(v: number) {
    this._activeTab = v;
    this.panelState.set('equip.tab', v);
    this.equipPanel.tab = v;
    if (v === 4) this.initPan();
    if (v !== 4) {
      this.selectedNodeId = null;
      this.talentExpanded = false;
    }
    if (v !== 0) { this.statsFlyoutOpen = false; this.showGathering = false; this.selectedEquippedItem = null; }
    if (v !== 5) { this.selectedAch = null; this.expandedAchId = null; }
    if (v === 6) this.badges.clear('equip.quests');
  }

  // ── Skills de recolección (tab 7) ────────────────────────────────────────────

  /** Sub-pestañas: una por skill (minería, tala…). */
  readonly gatheringSkillTabs = GATHERING_SKILLS;
  activeSkillTab: GatheringSkillId = GATHERING_SKILLS[0].id;

  selectSkillTab(id: GatheringSkillId): void {
    this.activeSkillTab = id;
  }

  // ── Misiones (tab 6) ─────────────────────────────────────────────────────────

  showAvailableQuests = true;
  showCompletedQuests = false;
  expandedQuestId: string | null = null;
  /** Misiones cuyo acordeón ya se abrió: ocultan el icono de novedad. */
  private seenQuests = new Set<string>();

  toggleQuest(q: QuestDef): void {
    const opening = this.expandedQuestId !== q.id;
    this.expandedQuestId = opening ? q.id : null;
    if (opening) this.seenQuests.add(q.id);  // al abrir, deja de ser "novedad"
  }

  /** Muestra el icono de novedad: reclamable y aún no abierta. */
  questIsNew(q: QuestDef): boolean {
    return this.quests.isClaimable(q) && !this.seenQuests.has(q.id);
  }

  // Vista de equipo (tab 0): combate ↔ recolección comparten el mismo preview
  // (no se re-renderiza el sprite); solo cambian los slots equipables.
  showGathering = false;

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

  // Placeholder pixel-art de cada slot vacío.
  //   frame → recorta un frame de icons1.png (mismo estilo que los items)
  //   img   → PNG propio 32×32 en assets/icon/slots/ (slots sin frame en el sheet)
  //   icon  → ionicon de respaldo mientras el PNG no exista (evita imagen rota)
  readonly slotPlaceholders: Record<string, { frame?: number; img?: string; icon: string }> = {
    // ── Combate ──
    helmet:   { img: 'assets/icon/placeholder/helm.png', icon: 'shield-half-outline' },
    armor:    { frame: ICONS1['armor_chest'],   icon: 'shirt-outline' },
    pants:    { img: 'assets/icon/slots/pants.png',    icon: 'man-outline' },
    boots:    { img: 'assets/icon/placeholder/feet.png', icon: 'footsteps-outline' },
    weapon:   { frame: ICONS1['weapon_sword'],  icon: 'flash-outline' },
    necklace: { frame: ICONS1['gem_jewel_blue'], icon: 'diamond-outline' },
    ring1:    { frame: ICONS1['item_ring'],     icon: 'ellipse-outline' },
    ring2:    { frame: ICONS1['item_ring'],     icon: 'ellipse-outline' },
    food:     { frame: ICONS1['food_apple'],    icon: 'restaurant-outline' },
    potion:   { frame: ICONS1['potion_blue'],   icon: 'flask-outline' },
    // ── Recolección ──
    pickaxe:     { frame: ICONS1['tool_pick'],  icon: 'hammer-outline' },
    axe:         { img: 'assets/icon/slots/axe.png',      icon: 'cut-outline' },
    fishing_rod: { frame: ICONS1['item_hook'],  icon: 'fish-outline' },
    shovel:      { img: 'assets/icon/slots/shovel.png',   icon: 'trail-sign-outline' },
    lantern:     { img: 'assets/icon/slots/lantern.png',  icon: 'flashlight-outline' },
    backpack:    { img: 'assets/icon/slots/backpack.png', icon: 'bag-handle-outline' },
    gloves:      { img: 'assets/icon/slots/gloves.png',   icon: 'hand-left-outline' },
    belt:        { img: 'assets/icon/slots/belt.png',     icon: 'remove-outline' },
    compass:     { img: 'assets/icon/slots/compass.png',  icon: 'compass-outline' },
    pet:         { img: 'assets/icon/slots/pet.png',      icon: 'paw-outline' },
  };

  /** Slots cuyo PNG aún no existe → caen al ionicon de respaldo. */
  readonly placeholderImgFailed = new Set<string>();
  onPlaceholderImgError(slotId: string): void { this.placeholderImgFailed.add(slotId); }

  /** Tamaño de pintado del placeholder (px). El frame nativo es 32px → se escala. */
  readonly PLACEHOLDER_PX = 40;

  /** Estilo de fondo que recorta el `frame` de icons1.png, escalado a PLACEHOLDER_PX. */
  placeholderFrameStyle(frame: number): Record<string, string> {
    const size  = ICONS1_FRAME_SIZE;            // 32
    const cols  = ICONS1_COLS;                  // 12
    const scale = this.PLACEHOLDER_PX / size;   // 40 / 32
    const col   = frame % cols;
    const row   = Math.floor(frame / cols);
    return {
      'background-image':    'url(assets/icon/icons/icons1.png)',
      'background-repeat':   'no-repeat',
      'background-size':     `${cols * size * scale}px auto`,
      'background-position': `-${col * size * scale}px -${row * size * scale}px`,
    };
  }

  readonly loadoutIndices = [0, 1, 2];

  switchLoadout(index: number): void {
    this.equipmentService.switchLoadout(index);
    this.gatheringService.switchLoadout(index);
    this.talent.switchLoadout(index);
    this.selectedEquippedItem = null;   // el equipo cambió; cierra la ficha
  }

  // ── Logros (tab 4) ───────────────────────────────────────────────────────────

  achScope: AchievementScope = 'char';
  selectedAch: AchievementDef | null = null;
  /** Logro con la tarjeta desplegada (formato tarjeta, como misiones). */
  expandedAchId: string | null = null;

  setAchScope(scope: AchievementScope): void {
    this.achScope = scope;
    this.selectedAch = null;
    this.expandedAchId = null;
  }

  selectAch(a: AchievementDef): void {
    this.selectedAch = this.selectedAch?.id === a.id ? null : a;
  }

  toggleAch(a: AchievementDef): void {
    this.expandedAchId = this.expandedAchId === a.id ? null : a.id;
  }

  // Flyout de stats (tab 0): se abre al pinchar la pastilla, a la derecha del panel
  statsFlyoutOpen = false;

  toggleStatsFlyout(): void {
    this.statsFlyoutOpen = !this.statsFlyoutOpen;
    // Al abrirla ya has "visto" el punto nuevo: se apaga el badge
    if (this.statsFlyoutOpen) this.badges.clear('equip.stats');
  }

  // ── Detalle de ítem equipado (panel a la derecha, reutiliza app-item-detail) ──
  selectedEquippedItem: InventoryItem | null = null;
  equipDetailStyle: { [key: string]: string } = {};

  /** Pincha un slot equipado → muestra/oculta su ficha a la derecha del panel. */
  selectEquippedItem(item: InventoryItem | null, event: MouseEvent): void {
    event.stopPropagation();
    if (!item || this.selectedEquippedItem === item) {
      this.selectedEquippedItem = null;
      return;
    }
    this.selectedEquippedItem = item;
    const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
    this.equipDetailStyle = {
      top:       rect.top + 'px',
      left:      (rect.right + 12) + 'px',
      bottom:    '63px',
      'z-index': '210',   // por encima del modal de equipo
    };
  }

  clearEquippedSelection(): void {
    this.selectedEquippedItem = null;
  }

  /** Cierra la ficha al pinchar fuera de un slot equipado o del propio panel. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.selectedEquippedItem) return;
    const target = event.target as HTMLElement;
    if (target.closest('.equip-item') || target.closest('.detail-panel')) return;
    this.selectedEquippedItem = null;
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
    if (this._activeTab === 4) this.initPan();
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

  /** Nodos que se pintan. Admin: todos. Juego normal: solo desbloqueados + alcanzables
   *  (lo más profundo queda oculto). Como un alcanzable tiene siempre sus padres
   *  desbloqueados, ningún nodo visible queda con líneas colgando. */
  get visibleTreeNodes(): TalentNodeConfig[] {
    const nodes = this.activeTreeNodes;
    if (this.admin.isAdmin) return nodes;
    return nodes.filter(n => this.talent.isUnlocked(n.id) || this.talent.isReachable(n.id));
  }

  get treeLines(): { x1: number; y1: number; x2: number; y2: number; active: boolean; unlockable: boolean }[] {
    const nodes = this.visibleTreeNodes;
    const CW = 33, CH = 48;
    const cx = (col: number) => col * CW + CW / 2;
    const cy = (row: number) => row * CH + 21;
    return nodes.flatMap(node =>
      node.requires
        .map(reqId => {
          const parent = nodes.find(n => n.id === reqId);
          if (!parent) return null;
          // Dorada SOLO si ambos extremos están desbloqueados DE VERDAD (no por el override
          // de admin). Cualquier línea que toque un módulo bloqueado queda gris (base).
          const unlockable = this.nodeCanUnlock(node);
          return {
            x1: cx(parent.col), y1: cy(parent.row),
            x2: cx(node.col),   y2: cy(node.row),
            active: !unlockable && !!this.talent.unlocked[reqId] && !!this.talent.unlocked[node.id],
            unlockable,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null)
    );
  }

  nodeState(node: TalentNodeConfig): 'locked' | 'unlockable' | 'available' | 'slotted' {
    if (this.talent.isUnlocked(node.id)) {
      return this.talent.slotted[node.id] ? 'slotted' : 'available';
    }
    return this.talent.isReachable(node.id) ? 'unlockable' : 'locked';
  }

  nodeStyle(node: TalentNodeConfig): Record<string, string> {
    return { left: `${node.col * 33 + 3}px`, top: `${node.row * 48 + 3}px` };
  }

  /** Parpadea si está unido a un talento ya desbloqueado de verdad (tiene requisito
   *  y su padre real está desbloqueado) Y hay un punto disponible. Usa el estado REAL,
   *  no el override de admin: `canUnlock` = `isReachable` real + puntos. */
  nodeCanUnlock(node: TalentNodeConfig): boolean {
    return node.requires.length > 0 && this.talent.canUnlock(node.id);
  }

  nodeColor(node: TalentNodeConfig): string {
    const sphere = this.talent.slotted[node.id];
    return sphere ? this.sphereColors[sphere] : '';
  }

  /** Imagen de la habilidad del nodo (icono del registro de skills), o null si no es habilidad. */
  nodeImage(node: TalentNodeConfig): string | null {
    const ability = node.effect.ability;
    return ability ? (SKILL_REGISTRY[ability]?.iconPath ?? null) : null;
  }

  onNodeClick(node: TalentNodeConfig): void {
    if (this.panMoved) return;
    // Se abre si ya está desbloqueado (poner gema) o es alcanzable (desbloquear).
    if (!this.talent.isUnlocked(node.id) && !this.talent.isReachable(node.id)) return;
    this.selectedNodeId = this.selectedNodeId === node.id ? null : node.id;
    this.sphereAccordionOpen = false;
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

  /** Acordeón de esferas abierto bajo la ranura del nodo seleccionado */
  sphereAccordionOpen = false;

  toggleSphereAccordion(): void {
    this.sphereAccordionOpen = !this.sphereAccordionOpen;
  }

  /** Esferas elegibles para el nodo: una por color con stock (o la ya equipada). */
  availableSpheres(): SphereType[] {
    const id = this.selectedNodeId;
    if (!id) return [];
    return this.sphereTypes.filter(
      s => this.talent.spheresAvailable(s) > 0 || this.talent.slotted[id] === s,
    );
  }

  clearTalentSelection(): void {
    this.selectedNodeId = null;
    this.sphereAccordionOpen = false;
  }

  // ── Puntos de talento ──────────────────────────────────────────────────────
  get talentPointsAvailable(): number { return this.talent.pointsAvailable(); }
  get talentPointsTotal(): number     { return this.talent.pointsTotal(); }

  /** El nodo seleccionado está sin desbloquear pero es alcanzable (muestra botón) */
  selectedIsReachable(): boolean {
    return !!this.selectedNodeId && this.talent.isReachable(this.selectedNodeId);
  }

  /** Hay puntos para pagar el desbloqueo del nodo seleccionado (botón activo) */
  canAffordUnlock(): boolean {
    return !!this.selectedNodeId && this.talent.canUnlock(this.selectedNodeId);
  }

  /** El nodo seleccionado ya está desbloqueado (admite gemas). Usa el estado REAL,
   *  no el override de admin: si no, en admin todos los nodos cuentan como
   *  desbloqueados y nunca se mostraría el botón de desbloquear (la estrella). */
  selectedIsUnlocked(): boolean {
    return !!this.selectedNodeId && this.talent.isReallyUnlocked(this.selectedNodeId);
  }

  unlockSelected(): void {
    if (this.selectedNodeId) this.talent.unlock(this.selectedNodeId);
    // No cerramos: tras desbloquear, el picker pasa a mostrar las gemas.
  }

  slotSphere(sphere: SphereType): void {
    if (!this.selectedNodeId) return;
    this.talent.slot(this.selectedNodeId, sphere);
    // No cerramos el picker: cierra solo el acordeón para ver el nuevo valor del efecto.
    this.sphereAccordionOpen = false;
  }

  canUnslotSelected(): boolean {
    return !!this.selectedNodeId && !!this.talent.slotted[this.selectedNodeId];
  }

  unslotSelected(): void {
    if (this.selectedNodeId) this.talent.unslot(this.selectedNodeId);
    this.sphereAccordionOpen = false;
  }

  canLockSelected(): boolean {
    return !!this.selectedNodeId && this.talent.canLock(this.selectedNodeId);
  }

  lockSelected(): void {
    if (this.selectedNodeId) this.talent.lock(this.selectedNodeId);
    this.clearTalentSelection();
  }

  nodeEffectLabel(node: TalentNodeConfig, sphere: SphereType): string {
    return this.effectLabel(node, node.effect.base * SPHERE_MULT[sphere]);
  }

  /** Lo que aporta el nodo AHORA mismo: ×mult de la gema puesta, o ×1 si solo está desbloqueado. */
  nodeActiveEffect(node: TalentNodeConfig): string {
    const sphere = this.talent.slotted[node.id];
    const mult = sphere ? SPHERE_MULT[sphere] : 1;
    return this.effectLabel(node, node.effect.base * mult);
  }

  private effectLabel(node: TalentNodeConfig, val: number): string {
    switch (node.effect.type) {
      case 'magicAtk':   return `+${val} M.ATK`;
      case 'hp':         return `+${val} HP`;
      case 'mp':         return `+${val} MP`;
      case 'defense':    return `+${val} DEF`;
      case 'evasion':    return `+${val}% EVA`;
      case 'critChance': return `+${val}% CRIT`;
      case 'hpRegen':    return `+${val} HP/regen`;
      case 'mpRegen':    return `+${val} MP/regen`;
      case 'dropRate':   return `+${val}% DROP`;
      case 'miningEfficiency': return `+${val}% MIN`;
      case 'miningDrop':       return `×${1 + val} botín MIN`;
      default:           return `+${val} ATK`;
    }
  }

  formatNodeLabel(node: TalentNodeConfig): string {
    return node.label.replace('\n', ' ');
  }

  constructor(
    public equipmentService: EquipmentService,
    public gatheringService: GatheringEquipmentService,
    public gatheringSkills: GatheringSkillsService,
    private inventoryService: InventoryService,
    public charStats: CharacterStatsService,
    public playerState: PlayerStateService,
    public talent: TalentService,
  ) {}

  ngOnInit(): void {
    this._activeTab = this.panelState.get('equip.tab', 0);
    // Tabs ya retiradas (1 recolección fusionada, 3 árbol Phaser) o fuera de rango → al primero
    if (this._activeTab > 7 || this._activeTab === 1 || this._activeTab === 3) this._activeTab = 0;
    if (this._activeTab === 4) this.initPan();
    // Publica el estado para el comparador del inventario
    this.equipPanel.open = true;
    this.equipPanel.tab = this._activeTab;

    // Refresca el overlay de cooldown de poción mientras el panel está abierto
    this.potionCdInterval = setInterval(() => {
      this.potionCdActive  = this.playerBridge.autoPotionOnCooldown && !!this.playerBridge.autoPotionItem;
      this.potionCdRatio   = this.playerBridge.autoPotionReadyRatio;
      this.potionCdSeconds = this.playerBridge.autoPotionCooldownSeconds;
    }, 250);
  }

  ngOnDestroy(): void {
    this.equipPanel.open = false;
    clearInterval(this.potionCdInterval);
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

    // Mascota sin vincular: preguntar antes de equipar (se vincula a este personaje)
    if (item.petId && !item.boundCharId) {
      this.pendingPetEquip = { data, slot };
      this.petBindModalOpen = true;
      return;
    }

    this.doGatheringEquip(data, slot, item);
  }

  private doGatheringEquip(data: any, slot: GatheringSlot, item: InventoryItem): void {
    const displaced = this.gatheringService.equip(`gather-${slot.id}`, item);
    if (data.sourceContext === 'inventory') {
      this.inventoryService.removeRequest$.next({ tabIndex: data.tabIndex, row: data.row, col: data.col });
      if (displaced) this.inventoryService.itemDropped$.next(displaced);
    }
  }

  // ── Vínculo de mascota a personaje ───────────────────────────────────────────
  petBindModalOpen = false;
  private pendingPetEquip: { data: any; slot: GatheringSlot } | null = null;

  get pendingPetName(): string {
    return this.pendingPetEquip?.data?.item?.name ?? '';
  }

  get currentCharName(): string {
    return this.asgard.selectedPlayer?.name ?? '';
  }

  confirmPetBind(): void {
    if (!this.pendingPetEquip) return;
    const { data, slot } = this.pendingPetEquip;
    const item: InventoryItem = data.item;
    item.boundCharId   = String(this.asgard.selectedPlayer?.id ?? '');
    item.boundCharName = this.asgard.selectedPlayer?.name ?? '';
    this.doGatheringEquip(data, slot, item);
    this.petBindModalOpen = false;
    this.pendingPetEquip = null;
  }

  cancelPetBind(): void {
    this.petBindModalOpen = false;
    this.pendingPetEquip = null;
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
