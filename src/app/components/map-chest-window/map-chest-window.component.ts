import { Component, inject } from '@angular/core';
import { MapUpgradesService, MapUpgradeDef, MapMaterial } from 'src/app/services/map-upgrades.service';
import { WorldService } from 'src/app/services/world.service';

/**
 * Ventana de MEJORAS DE MAPA (se abre desde el cofre central del mapa). Dos pestañas:
 * "Por completar" y "Completados" (no acumulativas: cada mejora se completa una vez).
 * Se pagan con el material que sueltan los enemigos del mapa (MapUpgradesService).
 */
@Component({
  selector: 'app-map-chest-window',
  templateUrl: './map-chest-window.component.html',
  styleUrls: ['./map-chest-window.component.scss'],
  standalone: false,
})
export class MapChestWindowComponent {
  private up = inject(MapUpgradesService);
  private world = inject(WorldService);

  tab: 'pending' | 'done' = 'pending';

  get mapId(): string { return this.world.currentMap$.value?.id ?? ''; }

  get material(): MapMaterial | null { return this.up.materialFor(this.mapId); }
  get materialCount(): number { return this.up.materialCount(this.mapId); }

  get list(): MapUpgradeDef[] {
    return this.tab === 'pending' ? this.up.pending(this.mapId) : this.up.done(this.mapId);
  }

  cost(id: string): number { return this.up.cost(id); }
  canComplete(id: string): boolean { return this.up.canComplete(this.mapId, id); }
  complete(id: string): void { this.up.complete(this.mapId, id); }

  get canReset(): boolean { return this.up.hasAnyCompleted(this.mapId); }
  reset(): void { this.up.reset(this.mapId); }
}
