import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { PortalUnlockService, PortalUnlockReq } from 'src/app/services/portal-unlock.service';
import { InventoryService } from 'src/app/services/inventory.service';

interface CostRow { name: string; qty: number; have: number; icon: string; enough: boolean; }

/**
 * Ventana FLOTANTE de "portal sellado". La escena Phaser la abre por proximidad
 * (`PortalUnlockService.open`) al acercarte a un portal bloqueado y actualiza su ancla
 * (`service.anchor`, en px CSS) cada frame; este componente se pinta anclado JUSTO
 * ENCIMA del portal y lo sigue mientras la cámara se mueve. Muestra el coste en
 * materiales (icono + tengo/necesito) y un botón Aceptar activo solo si el jugador tiene
 * los recursos. Al confirmar, el servicio cobra los materiales y marca el flag → el
 * portal se abre (la escena lo detecta vía `unlocks.hasFlag`). Se cierra al alejarse.
 *
 * Phaser corre FUERA de la zona de Angular → reentramos en NgZone en la suscripción; el
 * seguimiento del ancla va en un rAF FUERA de zona (solo escribe `transform`, sin CD).
 */
@Component({
  selector: 'app-portal-unlock',
  templateUrl: './portal-unlock.component.html',
  styleUrls: ['./portal-unlock.component.scss'],
  standalone: false,
})
export class PortalUnlockComponent implements OnInit, OnDestroy {
  private portal = inject(PortalUnlockService);
  private inventory = inject(InventoryService);
  private zone = inject(NgZone);

  @ViewChild('box') private boxRef?: ElementRef<HTMLElement>;

  req: PortalUnlockReq | null = null;
  rows: CostRow[] = [];
  affordable = false;

  private sub?: Subscription;
  private invSub?: Subscription;
  private raf?: number;

  ngOnInit(): void {
    this.sub = this.portal.request$.subscribe(req => this.zone.run(() => {
      this.req = req;
      this.refresh();
      if (req) this.startTracking();
      else this.stopTracking();
    }));
    // Con la ventana abierta, refresca tengo/necesito si cambia el inventario (p.ej. un
    // drop cercano completa el coste → habilita Aceptar sin tener que reabrir).
    this.invSub = this.inventory.changes$.subscribe(() => {
      if (this.req) this.zone.run(() => this.refresh());
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.invSub?.unsubscribe();
    this.stopTracking();
  }

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

  // ── Anclaje: sigue la posición en pantalla del portal (fuera de la zona Angular) ──
  private startTracking(): void {
    if (this.raf != null) return;
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        const el = this.boxRef?.nativeElement;
        if (el) this.place(el);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    });
  }

  /** Coloca la ventana centrada sobre el portal, pero ACOTADA al viewport (si el portal
   *  está pegado a un borde, la ventana no se sale; el pico se desplaza para seguir
   *  apuntando al portal). Bottom-anclada en el borde superior del disco. */
  private place(el: HTMLElement): void {
    const a = this.portal.anchor;
    const M = 6;                                    // margen a los bordes
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth;
    // Centrada en el portal en X, sin salirse por los lados.
    const left = Math.max(M, Math.min(a.x - w / 2, vw - M - w));
    // Bottom en el borde del disco; si no cabe arriba, baja para no salirse por arriba.
    const top = Math.max(M + h, a.y);
    el.style.transform = `translate(${left}px, ${top}px) translateY(-100%)`;
    // El pico sigue apuntando al portal aunque la ventana se haya desplazado del centro.
    const beak = el.querySelector('.pu-beak') as HTMLElement | null;
    if (beak) beak.style.left = `${Math.max(12, Math.min(a.x - left, w - 12))}px`;
  }

  private stopTracking(): void {
    if (this.raf != null) { cancelAnimationFrame(this.raf); this.raf = undefined; }
  }
}
