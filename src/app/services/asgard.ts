import { Injectable } from '@angular/core';
import { IAttack, Player } from '../pnj/player/player';
import { StorageService } from './storage.service'; // Asegúrate de que la ruta es correcta

@Injectable({
  providedIn: 'root'
})
export class AsgardService {
  _characters: any = null;
  player: Player;

  constructor(private storageService: StorageService) { }

  setCharacters(v: any) {
    this._characters = v;
  }

  // Ahora es asíncrono para poder mirar el Storage si hace falta
  async getCharacters() {
    if (!this._characters) {
      console.log('AsgardService: No hay RAM, mirando en Storage...');
      this._characters = await this.storageService.get('user_characters');
    }
    return this._characters;
  }

  createPlayer(data: Player) {
    if (!data) return;
    this.player = new Player();
  }

  getPlayer() {
    return this.player;
  }

  setInitialSprites(sprites: any) {
    this.player.setInitialSprites(sprites)
  }

  setAttackToPlayer(attack: IAttack) {
    this.player.receiveAttack(attack);
  }
}