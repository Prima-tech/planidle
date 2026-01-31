
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
  characters: any = null;

  constructor(
    private router: Router,
    private asgardService: AsgardService,
    private storageService: StorageService,
    private supabaseService: SupabaseService
  ) { }

  ngOnInit() {
    this.getCharacters();
  }

  async getCharacters() {
    this.characters = await this.asgardService.getCharacters();
    console.log('soy los characters', this.characters)
  }

  continuar() {
    console.log('Navegando desde globalposition');
    this.router.navigate(['/map']);
  }

  async createPlayer() {
    try {
      const newHero = {
        name: 'Warrior',
        character_class: 'Warrior'
      };
      const { data, error } = await this.supabaseService.createCharacter(newHero);
      if (error) throw error;
      const currentChars = await this.storageService.get('user_characters') || [];
      currentChars.push(data[0]);
      await this.storageService.set('user_characters', currentChars);
      this.characters = currentChars;
      console.log('Character created and stored!', data[0]);
    } catch (err) {
      console.error('Error in programmatic creation:', err);
    }
  }

}
