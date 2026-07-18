import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { PortalUnlockService, PortalUnlockReq } from 'src/app/services/portal-unlock.service';

interface CostRow { name: string; qty: number; have: number; icon: string; enough: boolean; }

/**
 * Ventana de "portal sellado". La escena Phaser llama a `PortalUnlockService.open(req)`
 * al interactuar con un portal bloqueado; este componente lee `request$` y muestra un
 * modal centrado con el coste en materiales (icono + tengo/necesito). Al confirmar,
 * el servicio cobra los materiales y marca el flag → el portal se abre (la escena lo
 * detecta vía `unlocks.hasFlag`). Se cierra con Cancelar o al tocar fuera (o cuando la
 * escena cierra la petición al alejarse el jugador del portal).
 *
 * Phaser corre FUERA de la zona de Angular → reentramos en NgZone en la suscripción.
 */
@Component({
  selector: 'app-portal-unlock',
  templateUrl: './portal-unlock.component.html',
  styleUrls: ['./portal-unlock.component.scss'],
  standalone: false,
})
export class PortalUnlockComponent implements OnInit, OnDestroy {
  private portal = inject(PortalUnlockService);
  private zone = inject(NgZone);

  req: PortalUnlockReq | null = null;
  rows: CostRow[] = [];
  affordable = false;
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.portal.request$.subscribe(req => this.zone.run(() => {
      this.req = req;
      this.refresh();
    }));
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  /** Recalcula las filas de coste (tengo/necesito + icono) y si alcanza para pagar. */
  private refresh(): void {
    if (!this.req) { this.rows = []; this.affordable = false; return; }
    this.rows = this.req.cost.map(c => {
      const have = this.portal.have(c.name);
      return { name: c.name, qty: c.qty, have, icon: this.portal.iconFor(c.name), enough: have >= c.qty };
    });
    this.affordable = this.portal.canAfford(this.req);
  }

  confirm(): void {
    // confirm() cobra y cierra; si no alcanzaba (carrera), refrescamos el estado.
    if (!this.portal.confirm()) this.refresh();
  }

  cancel(): void { this.portal.close(); }
}
