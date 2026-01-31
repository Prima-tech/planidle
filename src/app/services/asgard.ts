import { Injectable } from '@angular/core';
import { IAttack, Player } from '../pnj/player/player';


@Injectable({
  providedIn: 'root'
})
export class AsgardService {
  _characters: any;
  player: Player;

  constructor() { }

  setCharacters(v: any) {
    this._characters = v;
  }

  getCharacters() {
    return this._characters
  }









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
