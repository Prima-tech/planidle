import { Direction } from "src/app/pnj/interfaces/Direction";


export const playerAnimations = {
  IDLE :{
    [Direction.UP]: { start: 0, end: 1 },
    [Direction.LEFT]: { start: 13, end: 14 },
    [Direction.DOWN]: { start: 26, end: 27 },
    [Direction.RIGHT]: { start: 39, end: 40 },
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
  }
}

export const playerTags = {
  WALK:'player_walk_',
  IDLE: 'player_idle_',
  ATTACK:'player_attack_'
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