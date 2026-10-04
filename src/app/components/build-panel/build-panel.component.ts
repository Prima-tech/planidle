import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';
import { BuildCategory, BuildableDef, CityBuildService } from 'src/app/services/city-build.service';

/** Filtro de la rejilla: todo o una categoría. */
type BuildFilter = 'all' | BuildCategory;

/** Ficha de la rejilla: el construible y si aún está bloqueado (sin receta). */
interface BuildCard {
  def: BuildableDef;
  locked: boolean;
}

@Component({
  selector: 'app-build-panel',
  templateUrl: './build-panel.component.html',
  styleUrls: ['./build-panel.component.scss'],
  standalone: false,
})
export class BuildPanelComponent {

  private cityBuild = inject(CityBuildService);
  private admin = inject(AdminService);
  private el = inject(ElementRef) as ElementRef<HTMLElement>;

  readonly FILTERS: { key: BuildFilter; label: string }[] = [
    { key: 'all',     label: 'BUILD.CAT_ALL' },
    { key: 'craft',   label: 'BUILD.CAT_CRAFT' },
    { key: 'storage', label: 'BUILD.CAT_STORAGE' },
    { key: 'trade',   label: 'BUILD.CAT_TRADE' },
  ];
  filter: BuildFilter = 'all';

  /** Ficha de detalle abierta (a la derecha del panel, como la del inventario). */
  selected: BuildableDef | null = null;
  detailStyle: { [key: string]: string } = {};

  readonly CHEST_FRAME_SIZE = 32;
  readonly CHEST_COLS       = 10;

  setFilter(f: BuildFilter): void {
    this.filter = f;
    this.selected = null;
  }

  /** Fichas de la rejilla: primero lo construible (sin los uniques ya puestos), luego lo
   *  que aún no tiene receta, en silueta y con candado (no desvela qué es).
   *  En modo admin, el catálogo entero construible (lo que hacía la antigua pestaña Admin). */
  get cards(): BuildCard[] {
    const inFilter = (d: BuildableDef) => this.filter === 'all' || (d.category ?? 'craft') === this.filter;
    const defs = this.cityBuild.buildables.filter(inFilter);
    if (this.admin.isAdmin) return defs.map(def => ({ def, locked: false }));
    const open   = defs.filter(d => this.cityBuild.isAvailable(d) && !(d.unique && this.cityBuild.isBuilt(d.type)));
    const locked = defs.filter(d => !this.cityBuild.isAvailable(d));
    return [...open.map(def => ({ def, locked: false })), ...locked.map(def => ({ def, locked: true }))];
  }

  trackCard(_: number, c: BuildCard): string { return c.def.type; }

  /** ¿Hay edificios colocados que se puedan mover? */
  get hasBuildings(): boolean {
    return this.cityBuild.hasBuildings();
  }

  /** Guía: el banco de trabajo aprendido y sin construir brilla ("constrúyeme"). */
  isGuide(def: BuildableDef): boolean {
    return def.type === 'workbench' && this.cityBuild.isGuideBuild(def.type);
  }

  /** Pinchar una ficha abre (o cierra) su detalle a la derecha del panel. */
  pick(card: BuildCard, event: MouseEvent): void {
    event.stopPropagation();
    if (card.locked) return;   // bloqueado: no se desvela nada
    if (this.selected === card.def) { this.selected = null; return; }
    this.selected = card.def;
    const rect = this.el.nativeElement.getBoundingClientRect();
    // Mismo alto que la ventana de Construir (arriba y abajo alineadas con ella).
    this.detailStyle = {
      top:       rect.top + 'px',
      height:    rect.height + 'px',
      left:      (rect.right + 12) + 'px',
      'z-index': '210',
    };
  }

  /** Construir desde la ficha: arranca el ghost (el footer cierra todas las ventanas). */
  build(): void {
    if (!this.selected) return;
    const def = this.selected;
    this.selected = null;
    this.cityBuild.startPlacement(def);
  }

  descKey(def: BuildableDef): string {
    return 'BUILD.DESC.' + def.type.toUpperCase();
  }

  builtCount(def: BuildableDef): number {
    return this.cityBuild.countBuilt(def.type);
  }

  /** Cierra la ficha al pinchar fuera de las fichas o de la propia ficha de detalle. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.selected) return;
    const target = event.target as HTMLElement;
    if (target.closest('.build-card') || target.closest('.build-detail')) return;
    this.selected = null;
  }

  /** Entra en modo "mover edificio": pinchar un edificio del mapa lo edita. */
  startMove(): void {
    this.cityBuild.startMoveMode();
  }

  /** Entra en modo "borrar edificio": pinchar un edificio pide confirmación. */
  startDelete(): void {
    this.cityBuild.startDeleteMode();
  }

  /** Recorte del frame para el preview de la ficha.
   *  - Con `previewSrc` (estaciones): recorte explícito en px de la hoja `previewUrl`.
   *  - Sin él (cofre/tienda): rejilla por defecto de la hoja 'chests' (10 cols, 32×32, ×2). */
  frameStyle(def: BuildableDef): Record<string, string> {
    if (def.previewSrc && def.previewSheet) {
      const s = def.previewScale ?? 1;
      const r = def.previewSrc, sheet = def.previewSheet;
      return {
        'background-image':    `url(${def.previewUrl})`,
        'background-repeat':   'no-repeat',
        'background-size':     `${sheet.w * s}px ${sheet.h * s}px`,
        'background-position': `-${r.x * s}px -${r.y * s}px`,
        'image-rendering':     'pixelated',
        'width':               `${r.w * s}px`,
        'height':              `${r.h * s}px`,
      };
    }
    const scale = def.previewScale ?? 2;
    const size  = this.CHEST_FRAME_SIZE;
    return {
      'background-image':    `url(assets/sprites/resources/${def.spriteKey}.png)`,
      'background-repeat':   'no-repeat',
      'background-size':     `${this.CHEST_COLS * size * scale}px auto`,
      'background-position': `-${def.frame * size * scale}px 0px`,
      'image-rendering':     'pixelated',
      'width':               `${size * scale}px`,
      'height':              `${size * scale}px`,
    };
  }
}
