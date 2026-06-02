export interface EquipLayerConfig {
  key: string;        // clave de textura en Phaser
  path: string;       // ruta al spritesheet LPC (64×64 por frame, mismo layout que player)
  frameWidth: number;
  frameHeight: number;
  depth: number;      // profundidad de render (mayor = delante)
}

// Mapea nombre de item → config de capa visual
// Cada spritesheet debe ser LPC estándar (mismo layout que assets/sprites/player/character/body/main.png)
export const EQUIP_LAYER_REGISTRY: Record<string, EquipLayerConfig> = {
  'Espada': {
    key: 'equip_espada',
    path: 'assets/sprites/player/equip/right-hand/long_knife.png',
    frameWidth: 64,
    frameHeight: 64,
    depth: 4,
  },
};
