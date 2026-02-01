import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AsgardService } from 'src/app/services/asgard';
import { StorageService } from 'src/app/services/storage.service';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  selector: 'app-globalposition',
  templateUrl: './globalposition.page.html',
  styleUrls: ['./globalposition.page.scss'],
  standalone: false,
})
export class GlobalpositionPage implements OnInit {
  // Súper importante: inicializar como array vacío []

  isSelected: boolean = false;

  constructor(
    private router: Router,
    public asgardService: AsgardService,
    private storageService: StorageService,
    private supabaseService: SupabaseService
  ) { }

  async ngOnInit() {
    await this.asgardService.refreshData();
  }
  /*

  async createPlayer() {
    try {
      const newHero = { name: 'Merlin', character_class: 'Mage' };
      const { data, error } = await this.supabaseService.createCharacter(newHero);

      if (error) throw error;

      if (data && data[0]) {
        // Usamos spread para actualizar la referencia del array
        this.characters = [...this.characters, data[0]];
        this.asgardService.setCharacters(this.characters);
        await this.storageService.set('user_characters', this.characters);
      }
    } catch (err) {
      console.error('Error creando player:', err);
    }
  }
    */

  continue() {
    this.asgardService.setSelectedPlayer(this.isSelected);
    this.router.navigate(['/main']);
  }

  selectPlayer(player: any) {
    console.log('soy el player', player)
    this.isSelected = player;
  }
}