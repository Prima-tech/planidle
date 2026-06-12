# notif-badge — Badges de notificación ("hay algo nuevo aquí")

Sistema de puntos rojos pulsantes (estilo "tienes algo pendiente") sobre botones,
pestañas o pastillas. Un badge se enciende cuando ocurre algo (subir de nivel,
desbloquear algo…) y se apaga cuando el jugador "ve" la pantalla correspondiente.

## Arquitectura

```
src/app/services/notification-badge.service.ts  ← NotificationBadgeService (estado)
src/global.scss                                 ← clase .notif-dot (el punto rojo)
```

### Claves jerárquicas

Las claves son rutas con puntos, de ventana a elemento concreto:

| Clave | Significado |
|-------|-------------|
| `equip.stats` | Punto de stat sin gastar (pastilla de stats, tab 0 de equipo) |

- `flag('equip.stats')` enciende también `has('equip')` — el botón que abre la
  ventana se ilumina solo, sin cablear nada extra.
- `clear('equip')` borraría `equip` y TODOS sus hijos. Normalmente se limpia la
  hoja concreta (`clear('equip.stats')`) cuando el jugador ve esa pantalla.
- **Solo se flaggean hojas** (claves completas), nunca padres.

### API

```typescript
badges.flag('ventana.elemento');   // marcar (idempotente)
badges.clear('ventana.elemento');  // desmarcar la clave y sus hijas
badges.has('ventana');             // ¿esta clave o alguna hija está marcada?
```

Estado en memoria (se pierde al recargar). Si algún badge debe sobrevivir
sesiones, persistir las claves en StorageService — no implementado aún.

## Receta: añadir un badge nuevo

### 1. Disparador (cuándo se enciende)

Llamar a `badges.flag('mi.clave')` donde ocurre el evento. Ejemplo real
(subida de nivel, en `LayoutComponent.ngOnInit`):

```typescript
this.lvlSub = this.playerStateService.lvl$.subscribe((lvl: number) => {
  if (this.saveService.isRestoring || this.lastLvl === null) {
    this.lastLvl = lvl;   // primer valor o restore: no es una subida real
    return;
  }
  if (lvl > this.lastLvl) this.badges.flag('equip.stats');
  this.lastLvl = lvl;
});
```

> **Guard de restore**: cualquier disparador basado en observables de estado
> debe ignorar emisiones mientras `saveService.isRestoring` — si no, cargar o
> cambiar de personaje enciende badges falsos.

### 2. El punto rojo (dónde se ve)

En el template del botón/pestaña/pastilla (el contenedor necesita
`position: relative`):

```html
<span class="notif-dot" *ngIf="badges.has('mi.clave')"></span>
```

En el componente: `badges = inject(NotificationBadgeService);` (público, lo usa
el template). La clase `.notif-dot` vive en `global.scss` — NO copiarla a los
SCSS de componentes.

En el botón que abre la ventana contenedora se usa la clave padre:
`badges.has('equip')` (footer) en lugar de la hoja.

### 3. Apagado (cuándo se ha "visto")

`badges.clear('mi.clave')` en la acción que muestra el contenido. Ejemplo real
(abrir el flyout de stats, en `EquipmentComponent`):

```typescript
toggleStatsFlyout(): void {
  this.statsFlyoutOpen = !this.statsFlyoutOpen;
  if (this.statsFlyoutOpen) this.badges.clear('equip.stats');
}
```

## Implementados

| Clave | Enciende | Punto rojo en | Se apaga al |
|-------|----------|---------------|-------------|
| `equip.stats` | Subir de nivel (LayoutComponent) | Botón equipo del footer (`has('equip')`) + pastilla de stats (`has('equip.stats')`) | Abrir el flyout de stats |

Al añadir un badge nuevo, **actualizar esta tabla**.
