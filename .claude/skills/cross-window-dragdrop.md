---
description: Patrón para implementar drag & drop entre ventanas distintas (inventario ↔ equipamiento, almacén, forja). Se activa cuando se habla de conectar drag & drop entre paneles, equipar ítems, almacén, forja, nuevas ventanas de inventario o DnD cross-component.
triggers:
  - drag drop entre ventanas
  - equipar ítem
  - slot de equipamiento
  - almacén
  - forja
  - cross-component drag
  - cdkDropListConnectedTo
  - nueva ventana inventario
  - DnD cross
  - equipment slot
---

# Drag & Drop entre ventanas — patrón del proyecto

## Arquitectura general

Cada "ventana" (inventario, equipamiento, almacén, forja) es un componente Angular cargado dinámicamente por `ModalContainerComponent`. No comparten DOM ancestor, así que **`cdkDropListGroup` no conecta componentes distintos**. La conexión cross-componente se hace con IDs explícitos.

```
ModalContainerComponent #inventoryModal  → <app-inventory>   (cdkDropListGroup interno)
ModalContainerComponent #equipmentModal  → <app-equipment>   (slots independientes)
ModalContainerComponent #warehouseModal  → <app-warehouse>   (mismo patrón)
```

---

## Regla CDK v19 crítica

**`[cdkDropListId]` no existe en Angular CDK 19.** El alias fue eliminado.  
Usar **`[id]`** (atributo nativo) para asignar el ID del drop list:

```html
<!-- ❌ CDK <=18 — no funciona en v19 -->
[cdkDropListId]="'inv-0-0-0'"

<!-- ✅ CDK 19 -->
[id]="'inv-' + tabIndex + '-' + rowIndex + '-' + colIndex"
```

---

## IDs y conexiones

### Inventario (celdas)
- ID format: `inv-{tab}-{row}-{col}` → `inv-0-0-0` … `inv-3-3-4` (80 IDs)
- Conexión saliente (hacia equipamiento): `[cdkDropListConnectedTo]="equipmentSlotIds"`
- `cdkDropListGroup` sigue presente para moves internos (celda↔celda)

### Equipamiento (slots)
- ID format: `equip-{slotId}` → `equip-weapon`, `equip-shield`, `equip-helmet`…
- Conexión saliente (hacia inventario): `[cdkDropListConnectedTo]="equipmentService.inventoryCellIds"`
- Los 80 IDs de inventario se pre-generan una vez en `EquipmentService`

### Regla: la conexión es unidireccional en la declaración
CDK sólo requiere que la **fuente** declare el destino en `connectedTo`. No hace falta que el destino declare la fuente. Aun así, declarar ambas direcciones permite drag en ambos sentidos.

---

## Formato del drag data — discriminador de contexto

Todos los `[cdkDragData]` llevan `sourceContext` para que el handler del destino sepa de dónde viene el ítem:

```typescript
// Desde inventario
{ sourceContext: 'inventory', tabIndex: 0, row: 0, col: 0, item: {...} }

// Desde equipamiento
{ sourceContext: 'equipment', slotId: 'equip-weapon', item: {...} }

// Futuros sistemas
{ sourceContext: 'warehouse', ... }
{ sourceContext: 'forge', ... }
```

---

## Comunicación cross-componente — canales de eventos

El componente de destino **nunca toca directamente el array local** del componente origen. Usa subjects del servicio:

| Subject | Dónde vive | Quién emite | Quién escucha |
|---------|-----------|-------------|---------------|
| `InventoryService.removeRequest$` | `InventoryService` | `EquipmentComponent` (y futuros) | `InventoryComponent.ngOnInit` |
| `InventoryService.itemDropped$` | `InventoryService` | `EquipmentComponent` (devolver ítem desplazado) | `InventoryComponent.ngOnInit` |
| `EquipmentService.changes$` | `EquipmentService` | `EquipmentService.equip/unequip` | Cualquier componente que muestre estado de equipo |

### Flujo inventario → equipamiento

```
onEquipDrop(event, slot):
  1. canEquip(item, slotId) → falso → return (predicate ya lo bloquea visualmente)
  2. equipmentService.equip(slotId, item) → devuelve displaced (ítem anterior)
  3. inventoryService.removeRequest$.next({ tabIndex, row, col })
     └─ InventoryComponent escucha → inventories[t][r][c] = null → triggerSave()
  4. Si displaced → inventoryService.itemDropped$.next(displaced)
     └─ InventoryComponent escucha → addItemToInventory(displaced)
```

### Flujo equipamiento → inventario

```
onDrop(event, targetTab, targetRow, targetCol):
  if data.sourceContext === 'equipment':
    targetItem = inventories[t][r][c]
    if targetItem !== null → return (celda ocupada, rechazar)
    inventories[t][r][c] = data.item
    equipmentService.unequip(data.slotId)
    triggerSave()
```

---

## Validación con `cdkDropListEnterPredicate`

Usar **una sola función** por componente que lee el `id` del drop list destino:

```typescript
// equipment.component.ts
canDropInSlot = (drag: CdkDrag, drop: CdkDropList): boolean => {
  return this.equipmentService.canEquip(drag.data?.item, drop.id);
};
```

```html
<!-- equipment.component.html -->
<div cdkDropList [id]="'equip-' + slot.id" [cdkDropListEnterPredicate]="canDropInSlot">
```

`drop.id` es el `id` nativo del elemento → en CDK v19 es el mismo que pusimos con `[id]`.

---

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/services/equipment.service.ts` | Estado de slots, validación `canEquip`, IDs pre-generados de inventario |
| `src/app/services/inventory.service.ts` | `removeRequest$` — canal para que externos borren celdas |
| `src/app/components/equipment/equipment.component.*` | UI de slots, `onEquipDrop`, predicate |
| `src/app/components/inventory/inventory.component.*` | Suscripción a `removeRequest$`, handler de drops desde equipamiento |
| `src/app/components/footer-bar/footer-bar.component.*` | Abre el panel de equipamiento via `ModalContainerComponent` |
| `src/app/components/modal-container/modal-container.component.scss` | Estilo `.equipment` para posición del panel |

---

## Cómo añadir una nueva ventana (p.ej. Almacén)

1. **Crear `WarehouseService`** — igual que `EquipmentService`: slots, `canReceive()`, `inventoryCellIds`.
2. **Crear `WarehouseComponent`** — `cdkDropList` con `[id]="'warehouse-' + slot"`, `[cdkDropListConnectedTo]="warehouseService.inventoryCellIds"`, predicate si procede.
3. **Actualizar `InventoryComponent`**:
   - `[cdkDropListConnectedTo]="allExternalSlotIds"` (equipamiento + almacén + lo que sea)
   - Añadir rama `if data.sourceContext === 'warehouse'` en `onDrop()`
4. **Registrar en `components.module.ts`** y añadir botón en `footer-bar`.
5. **Añadir estilo** `.warehouse` en `modal-container.component.scss`.

No hace falta tocar `cdkDropListGroup` del inventario ni el sistema de guardado.

---

## Gotchas documentados

| Problema | Causa | Solución |
|---------|-------|----------|
| IDs auto-generados `cdk-drop-list-N` | `[cdkDropListId]` no existe en CDK v19 | Usar `[id]="..."` |
| Drops silenciosamente ignorados | String IDs en `connectedTo` no resuelven porque los IDs no están seteados | Ver punto anterior |
| Estado desincronizado tras borrado externo | `InventoryComponent` tiene su propia copia del grid | Usar `removeRequest$` subject, nunca mutar `mockGrid` desde fuera |
| Ocupada → ocupada en equip → inv | Drop en celda con ítem desde equipamiento | Rechazar explícitamente en `onDrop` si `targetItem !== null` y `sourceContext === 'equipment'` |
| Items de Phaser no aparecen en la ventana de equipamiento | `itemDropped$` sólo escucha `InventoryComponent` | Emitir también a través de `EquipmentService` si el ítem es equipable automáticamente |
