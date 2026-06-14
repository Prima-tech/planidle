import { Direction } from "src/app/pnj/interfaces/Direction";

// Factor de resolución nativa del canvas principal: el juego se renderiza a
// devicePixelRatio (mínimo 2× — supersampling también en pantallas 1×, como el
// árbol de talentos) y se reduce con zoom CSS. La cámara de GameScene y las
// medidas de pantalla del HUD multiplican por esto (capado a 3 por rendimiento).
export const NATIVE_DPR = Math.max(Math.min(window.devicePixelRatio || 1, 3), 2);


export const playerAnimations = {
  IDLE :{
    [Direction.UP]: { start: 286, end: 287 },
    [Direction.LEFT]: { start: 299, end: 300 },
    [Direction.DOWN]: { start: 312, end: 313 },
    [Direction.RIGHT]: { start: 325, end: 326 },
  },
  WALK: {
    [Direction.UP]: { start: 104, end: 112 },
    [Direction.LEFT]: { start: 117, end: 125 },
    [Direction.DOWN]: { start: 130, end: 138 },
    [Direction.RIGHT]: { start: 143, end: 150 },   
  },
  ATTACK: {
    [Direction.UP]: { start: 156, end: 161 },
    [Direction.LEFT]: { start: 169, end: 174 },
    [Direction.DOWN]: { start: 182, end: 187 },
    [Direction.RIGHT]: { start: 195, end: 200 },
  },
  // Estocada (thrust) LPC: filas 4-7, 8 frames. La usan las armas tipo bastón, cuya
  // capa de ataque está dibujada para superponerse a este movimiento del cuerpo.
  THRUST: {
    [Direction.UP]: { start: 52, end: 59 },
    [Direction.LEFT]: { start: 65, end: 72 },
    [Direction.DOWN]: { start: 78, end: 85 },
    [Direction.RIGHT]: { start: 91, end: 98 },
  },
  DEATH: {
    [Direction.UP]: { start: 260, end: 265 },
    [Direction.LEFT]: { start: 260, end: 265 },
    [Direction.DOWN]: { start: 260, end: 265 },
    [Direction.RIGHT]: { start: 260, end: 265 },
  }
}

export const playerTags = {
  WALK:'player_walk_',
  IDLE: 'player_idle_',
  ATTACK:'player_attack_',
  THRUST:'player_thrust_',
  DEATH:'player_death_'
}

export const enemyAnimations = {
  IDLE :{
    [Direction.UP]: { start: 156, end: 161 },
    [Direction.LEFT]: { start: 169, end: 174 },
    [Direction.DOWN]: { start: 182, end: 187 },
    [Direction.RIGHT]: { start: 195, end: 200 },
  },
  WALK: {
    [Direction.UP]: { start: 0, end: 3 },
    [Direction.LEFT]: { start: 4, end: 7 },
    [Direction.DOWN]: { start: 8, end: 11 },
    [Direction.RIGHT]: { start: 12, end: 15 },  
  },
  ATTACK: {
    [Direction.UP]: { start: 156, end: 161 },
    [Direction.LEFT]: { start: 169, end: 174 },
    [Direction.DOWN]: { start: 182, end: 187 },
    [Direction.RIGHT]: { start: 195, end: 200 },
  }
}

export const enemyTags = {
  WALK:'_walk_',
  IDLE: '_idle_',
  ATTACK:'_attack_',
  DIE: '_die_',
}