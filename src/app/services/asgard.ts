import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { Character } from '../classes/character.class';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { PlayerStateService } from './player-state.service';
import { SaveService } from './save.service';
import { PlayerBridgeService } from './player-bridge.service';

@Injectable({ providedIn: 'root' })
export class AsgardService {

  _characters: any = null;
  _profile:    any = null;
  selectedPlayer: Character;
  isChecking = true;

  private closeMenuSource = new Subject<void>();
  closeMenu$ = this.closeMenuSource.asObservable();

  constructor(
    private storageService: StorageService,
    private router: Router,
    private playerState: PlayerStateService,
    private saveService: SaveService,
    private playerBridge: PlayerBridgeService,
  ) {}

  // ── Roster ────────────────────────────────────────────────────────────────

  setCharacters(v: any)  { this._characters = v; }

  async getCharacters() {
    if (!this._characters) {
      this._characters = await this.storageService.get('characters');
    }
    return this._characters;
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  setProfile(v: any) {
    this._profile = v;
    this.playerState.setFromProfile(v);
  }

  async getProfile() {
    if (!this._profile) {
      this._profile = await this.storageService.get('user_data');
      this.playerState.setFromProfile(this._profile);
    }
    return this._profile;
  }

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

  // ── Session ───────────────────────────────────────────────────────────────

  async setSelectedPlayer(player: any): Promise<void> {
    this.selectedPlayer = new Character(player);
    await this.storageService.set('selected_player', player);
    await this.saveService.loadCharacter(String(player.id));
    this.playerBridge.resetPlayerStatus(
      this.selectedPlayer.current_hp ?? this.selectedPlayer.max_hp,
      this.selectedPlayer.max_hp,
    );
    this.playerBridge.restartGameScene();
  }

  async getSelectedPlayer(): Promise<Character> {
    if (this.selectedPlayer) return this.selectedPlayer;
    const data = await this.storageService.get('selected_player');
    if (data) this.selectedPlayer = new Character(data);
    return this.selectedPlayer;
  }

  async changePlayer(): Promise<void> {
    await this.saveService.saveCurrentCharacter();
    this.selectedPlayer = null;
    this.storageService.set('selected_player', null);
    this.router.navigate(['/globalposition']);
  }

  // ── UI events ─────────────────────────────────────────────────────────────

  triggerCloseMenu(): void {
    this.closeMenuSource.next();
  }
}
