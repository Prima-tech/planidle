import { Injectable } from '@angular/core';
import { IAttack, Player } from '../pnj/player/player';
import { StorageService } from './storage.service'; // Asegúrate de que la ruta es correcta
import { Character } from '../classes/character.class';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AsgardService {
  _characters: any = null;
  _profile: any = null;
  player: Player;
  selectedPlayer: Character;
  profile: any;
  isChecking: boolean = true;
  private closeMenuSource = new Subject<void>();
  closeMenu$ = this.closeMenuSource.asObservable();

  constructor(
    private storageService: StorageService,
    private router: Router
  ) { }


  async refreshData() {
    this.isChecking = true;
    try {
      await this.getCharacters();
      await this.getProfile();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      this.isChecking = false;
    }
  }

  setCharacters(v: any) {
    this._characters = v;
  }

  async getCharacters() {
    if (!this._characters) {
      this._characters = await this.storageService.get('characters');
    }
    return this._characters;
  }

  setProfile(v: any) {
    this._profile = v;
  }

  async getProfile() {
    if (!this._profile) {
      this._profile = await this.storageService.get('user_data');
    }
    return this._profile;
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

  async setSelectedPlayer(player: any) {
    this.selectedPlayer = new Character(player);
    await this.storageService.set('selected_player', player);
  }

  async getSelectedPlayer() {
    if (this.selectedPlayer) {
      return this.selectedPlayer;
    }

    const data = await this.storageService.get('selected_player');
    if (data) {
      this.selectedPlayer = new Character(data);
    }
    return this.selectedPlayer;
  }

  changePlayer() {
    this.selectedPlayer = null;
    this.storageService.set('selected_player', null);
    this.router.navigate(['/globalposition']);
  }

  triggerCloseMenu() {
    this.closeMenuSource.next();
  }
}