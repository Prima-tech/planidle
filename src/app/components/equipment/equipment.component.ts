import { Component, ElementRef, inject, OnInit } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { EquipmentService, EquipmentSlot } from 'src/app/services/equipment.service';
import { InventoryItem, InventoryService } from 'src/app/services/inventory.service';
import { CharacterStatsService, BaseStats, DefenseBreakdown, EvasionBreakdown, CritChanceBreakdown, CritDamageBreakdown, MagicDamageBreakdown, RegenBreakdown, DropRateBreakdown } from 'src/app/services/character-stats.service';
import { PlayerStateService, expNeeded, MAX_LEVEL } from 'src/app/services/player-state.service';
import { TalentService, TalentNodeConfig, SphereType, SPHERE_MULT, TALENT_NODES } from 'src/app/services/talent.service';
import { PanelStateService } from 'src/app/services/panel-state.service';

@Component({
  selector: 'app-equipment',
  templateUrl: './equipment.component.html',
  styleUrls: ['./equipment.component.scss'],
  standalone: false,
})
export class EquipmentComponent implements OnInit {

  private panelState = inject(PanelStateService);
  private el = inject(ElementRef);

  private _activeTab = 0;
  get activeTab(): number { return this._activeTab; }
  set activeTab(v: number) {
    this._activeTab = v;
    this.panelState.set('equip.tab', v);
    if (v !== 3) {
      this.selectedNodeId = null;
      this.talentExpanded = false;
    } else { this.initPan(); }
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

  readonly statsList: { key: keyof BaseStats; label: string }[] = [
    { key: 'STR',   label: 'Fuerza'        },
    { key: 'DEX',   label: 'Destreza'      },
    { key: 'CONST', label: 'Vitalidad'     },
    { key: 'INT',   label: 'Inteligencia'  },
    { key: 'MAG',   label: 'Magia'         },
    { key: 'CHR',   label: 'Carisma'       },
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
    this.initPan();
  }

  private initPan(): void {
    const nodes = this.activeTreeNodes;
    const root = nodes.find(n => n.requires.length === 0) ?? nodes[0];
    if (!root) { this.panX = 0; this.panY = 0; return; }
    this.panX = 113 - (root.col * 33 + 16);  // centra X en viewport 226px
    this.panY = 100 - (root.row * 48 + 22);  // nodo raíz a ~38% desde arriba
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
  }

  // ── Pan libre del árbol ──────────────────────────────────────────────────────

  panX = 0;
  panY = 0;
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

  slotSphere(sphere: SphereType): void {
    if (!this.selectedNodeId) return;
    this.talent.slot(this.selectedNodeId, sphere);
    this.selectedNodeId = null;
  }

  canUnslotSelected(): boolean {
    return !!this.selectedNodeId &&
           !!this.talent.slotted[this.selectedNodeId] &&
           !this.talent.hasDependents(this.selectedNodeId);
  }

  unslotSelected(): void {
    if (this.selectedNodeId) this.talent.unslot(this.selectedNodeId);
    this.selectedNodeId = null;
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
    private inventoryService: InventoryService,
    public charStats: CharacterStatsService,
    public playerState: PlayerStateService,
    public talent: TalentService,
  ) {}

  ngOnInit(): void {
    this._activeTab = this.panelState.get('equip.tab', 0);
  }

  // Predicate: sólo acepta ítems compatibles con este slot
  canDropInSlot = (drag: CdkDrag, drop: CdkDropList): boolean => {
    return this.equipmentService.canEquip(drag.data?.item, drop.id);
  };

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
