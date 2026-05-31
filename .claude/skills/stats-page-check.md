---
description: Recordatorio para evaluar si un dato nuevo de juego debería mostrarse en la página de estadísticas totales. Se activa cuando se implementa un nuevo contador, logro, métrica o dato acumulativo de juego.
triggers:
  - nuevo contador
  - nueva estadistica
  - nueva estadística
  - nuevo dato
  - nuevo sistema
  - contabilizar
  - rastrear
  - acumular
  - contador de
  - total de
  - historial
  - ranking
  - logro
  - achievement
  - daño recibido
  - daño infligido
  - pasos
  - distancia
  - tiempo jugado
  - pociones usadas
  - items crafteados
  - items vendidos
  - monedas gastadas
  - portales
  - mapas visitados
  - nivel maximo
  - boss
  - oleadas
---

# Skill: Stats Page Check

Cuando vayas a implementar un dato nuevo que se acumule, cuente, o registre a lo largo del tiempo de juego, **evalúa primero** si tiene sentido mostrarlo en la página de estadísticas totales antes de implementarlo.

## Qué muestra actualmente la página de estadísticas

**Componente:** `src/app/components/stats-page/stats-page.component.ts`

Dos secciones:

### Cuenta global
- Oro total en cuenta (suma de `coins` de todos los personajes)

### Jugador (por personaje)
- Oro ganado de por vida (`lifetimeCoins` en `PlayerState`)
- Muertes totales (`totalDeaths` en `PlayerState`)
- Enemigos eliminados (de `killService.charKills$`, todos los mapas agregados, solo los que tienen ≥1 kill)

## Qué tipo de datos encajan aquí

Encajan datos que:
- Son **acumulativos** (solo suben, nunca bajan)
- Tienen valor **histórico** (el jugador quiere ver su progreso total)
- Son **comprensibles** sin contexto adicional

Ejemplos que tendrían sentido añadir:
- Daño total infligido / recibido
- Items recogidos / usados / vendidos
- Tiempo total jugado con este personaje
- Portales usados / mapas visitados
- Nivel máximo alcanzado (si se puede resetear)
- Monedas gastadas en tiendas

## Instrucción obligatoria

**Antes de implementar** el nuevo dato, pregunta al usuario explícitamente:

> "Este dato ([nombre del dato]) es acumulativo / histórico. ¿Quieres que también lo muestre en la página de Estadísticas Totales?"

Si el usuario dice que sí:
1. Añade el campo a `PlayerState` (o donde corresponda según el tipo de dato)
2. Asegúrate de que se persiste en el snapshot (`save.service.ts`)
3. Muéstralo en `stats-page.component.html` en la sección correspondiente (global o jugador)
4. Actualiza `setFromProfile()` con `?? 0` para compatibilidad con snapshots antiguos

Si el dato es **global** (no por personaje), sigue el patrón de `KillService.globalKills` con una clave de storage propia.
