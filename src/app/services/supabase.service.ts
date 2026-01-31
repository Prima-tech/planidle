import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './storage.service';
import { AsgardService } from './asgard';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(
    private storageService: StorageService,
    private asgardService: AsgardService) {
    const supabaseOptions: any = {
      auth: {
        navigatorLock: false,
        persistSession: true,
        autoRefreshToken: true
      }
    };
    this.supabase = createClient('https://ycadrkbdmdwjtkslpbpp.supabase.co',
      'sb_publishable_5Hs1VoKmBEEpK0dsAYpJ7g_CNAf0WGG',
      supabaseOptions
    );
  }

  // --- AUTHENTICATION ---
  async signUp(email: string, pass: string) {
    return await this.supabase.auth.signUp({ email, password: pass });
  }

  async signIn(email: string, pass: string) {
    const response = await this.supabase.auth.signInWithPassword({ email, password: pass });
    if (response.data.user) {
      await this.fetchAndSaveLocalData(response.data.user.id);
    }
    return response;
  }

  // --- GAME DATA MANAGEMENT ---
  async fetchAndSaveLocalData(userId: string) {
    this.asgardService.setCharacters(this.getCharacters(userId));

    // Parallel requests for better performance
    /*
    const [profile, characters, inventory] = await Promise.all([
        this.supabase.from('profiles').select('*').eq('id', userId).single(),
        this.supabase.from('characters').select('*').eq('profile_id', userId),
        this.supabase.from('inventory').select('*').eq('profile_id', userId)
    ]);

    const gameState = {
        profile: profile.data,
        characters: characters.data,
        inventory: inventory.data,
        lastSync: new Date().getTime()
    };

    // Save the global state in Ionic Storage
    await this.storageService.set('game_state', gameState);
    return gameState;
    */
  }

  async getCharacters(userId: string) {
    const { data: characters, error } = await this.supabase
      .from('characters')
      .select('*')
      .eq('profile_id', userId);

    if (!error) {
      // We save the array of characters in local storage
      await this.storageService.set('user_characters', characters);
    }
    return characters;
  }

  // --- AUTO-SAVE LOGIC (To be called every 5 mins) ---
  async syncChanges(userId: string, updatedData: any) {
    const { error } = await this.supabase
      .from('profiles')
      .update({
        coins: updatedData.coins,
        last_sync: new Date()
      })
      .eq('id', userId);

    return error;
  }

  async createCharacter(characterData: { name: string, character_class: string }) {
    // Obtenemos el ID del usuario logueado
    const { data: { user } } = await this.supabase.auth.getUser();

    if (!user) throw new Error('No user logged in');

    const { data, error } = await this.supabase
      .from('characters') // Tabla en inglés
      .insert([
        {
          profile_id: user.id,
          name: characterData.name,
          character_class: characterData.character_class,
          max_hp: 100,
          current_hp: 100,
          experience_points: 0
        }
      ])
      .select(); // Esto es vital para que te devuelva el JSON del personaje creado

    return { data, error };
  }
}