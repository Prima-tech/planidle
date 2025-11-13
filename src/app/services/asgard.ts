import { Injectable } from '@angular/core';
import { IAttack, Player } from '../pnj/player/player';


@Injectable({
  providedIn: 'root'
})
export class AsgardService {

  //change player
    //top bar component

  player: Player;

  constructor() { }

  createPlayer(data: Player) {
    if (!data) return;
    this.player = new Player();
  }

  getPlayer() {
    return this.player;
  }

  setInitialSprites(sprites: any) {
   
 //   setTimeout(() => {
   this.player.setInitialSprites(sprites)
//}, 3000);
  }

  setAttackToPlayer(attack: IAttack) {
    this.player.receiveAttack(attack);
  }


}
