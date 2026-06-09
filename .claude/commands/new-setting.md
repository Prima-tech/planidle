# new-setting — Añadir un nuevo ajuste al panel de configuración

Guía para añadir un nuevo toggle, selector u opción al panel de Ajustes del juego.
Los ajustes se persisten automáticamente en `localStorage` bajo la clave `idle_game_settings`.

## Argumentos esperados

- **Nombre del ajuste** (ej. `showMinimap`, `musicVolume`)
- **Tipo** (`boolean` para toggle | `number` | `string`)
- **Valor por defecto**
- **Label visible** y **descripción corta** para el panel

---

## Paso 1 — Añadir al interface y defaults

Archivo: `src/app/services/game-settings.service.ts`

```typescript
// 1a — Añadir al interface GameSettings
export interface GameSettings {
  showJoystick: boolean;
  {nombre}: {tipo};          // ← nueva línea
}

// 1b — Añadir valor por defecto en DEFAULTS
const DEFAULTS: GameSettings = {
  showJoystick: true,
  {nombre}: {valorPorDefecto}, // ← nueva línea
};
```

---

## Paso 2 — Añadir shortcut tipado en el servicio

En la sección "Shortcuts tipados" de `GameSettingsService`:

```typescript
// Para boolean (toggle):
get {nombre}():  boolean { return this._settings.{nombre}; }
get {nombre}$()          { return this._subject.pipe(map(s => s.{nombre}), distinctUntilChanged()); }
set{NombrePascal}(v: boolean) { this.set('{nombre}', v); }

// Para number o string — igual pero con su tipo
get {nombre}(): {tipo} { return this._settings.{nombre}; }
get {nombre}$()        { return this._subject.pipe(map(s => s.{nombre}), distinctUntilChanged()); }
set{NombrePascal}(v: {tipo}) { this.set('{nombre}', v); }
```

> No tocar `load()`, `save()`, `get()` ni `set()` — funcionan para cualquier clave automáticamente.

---

## Paso 3 — Añadir la fila en el panel HTML

Archivo: `src/app/pages/game-settings/game-settings.page.html`

### Toggle (boolean)

```html
<div class="gs-row">
  <div class="gs-row-info">
    <span class="gs-row-title">{Label visible}</span>
    <span class="gs-row-desc">{Descripción corta}</span>
  </div>
  <div class="gs-toggle" [class.on]="gs.{nombre}" (click)="gs.set{NombrePascal}(!gs.{nombre})">
    <div class="gs-toggle-thumb"></div>
  </div>
</div>
```

### Selector numérico / texto — usar `<select>` o botones inline con clase `gs-option-btn`.

---

## Paso 4 — (Opcional) Reaccionar al cambio en Phaser

Si el ajuste afecta a una escena Phaser (como `showJoystick` afecta a `MobileHUDScene`):

1. Inyectar el servicio en la escena vía `this.game.registry.get(REGISTRY_KEYS.GAME_SETTINGS)`
2. Suscribirse al observable correspondiente dentro de `create()`
3. Cancelar la suscripción en `this.events.once(Phaser.Scenes.Events.SHUTDOWN, ...)`

```typescript
const gs = this.game.registry.get(REGISTRY_KEYS.GAME_SETTINGS);
let sub: Subscription | null = null;
if (gs) {
  sub = gs.{nombre}$.subscribe((v: {tipo}) => {
    // aplicar cambio en la escena
  });
}
this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sub?.unsubscribe());
```

---

## Checklist

- [ ] Campo añadido a `GameSettings` interface
- [ ] Valor por defecto en `DEFAULTS`
- [ ] Shortcut getter + observable + setter en el servicio
- [ ] Fila `.gs-row` añadida en el tab correcto del HTML
- [ ] Si afecta a Phaser: subscribe en la escena con cleanup en SHUTDOWN
