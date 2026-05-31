import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './storage.service';
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private storageService: StorageService) {
    const offlineFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      fetch(input, init).catch(() => new Response(null, { status: 503, statusText: 'Service Unavailable' }));

    this.supabase = createClient('https://ycadrkbdmdwjtkslpbpp.supabase.co',
      'sb_publishable_5Hs1VoKmBEEpK0dsAYpJ7g_CNAf0WGG',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        },
        global: { fetch: offlineFetch }
      }
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
  /*
  async fetchAndSaveLocalData(userId: string) {
    //this.asgardService.setCharacters(this.getCharacters(userId));
  }
  */

  async fetchAndSaveLocalData(userId: string) {
    const { data, error } = await this.supabase
      .from('global_data')
      .select(`
      *,
      characters (*),
      achievements (*)
    `)
      .eq('id', userId)
      .single();

    if (data) {
      // Transformamos los arrays en mapas hash antes de guardar en local
      debugger;
      const userData = {
        ...data,
        // characters: this.arrayToHash(data.characters),
        // achievements: this.arrayToHash(data.achievements)
      };

      await this.storageService.set('user_data', userData);
      await this.storageService.set('characters', data.characters);
      // characters ya guardados en StorageService — AsgardService los carga desde ahí
      return userData;
    } else if (error.code === 'PGRST116') {
      this.createFullAccount(userId, 'vlodos');
    }
    return null;
  }

  // Función auxiliar genérica para crear el Mapa Hash
  private arrayToHash(array: any[]) {
    return array.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }


  // supabase.service.ts

  async createFullAccount(userId: string, username: string) {
    try {
      // 1. Crear Global Data
      const { data: profile, error: pError } = await this.supabase
        .from('global_data')
        .insert([{
          id: userId,
          username: username,
          coins: 0,
          special_coins: 0,
          exp: 0,
          lvl: 1,
          last_modified: new Date().toISOString()
        }])
        .select()
        .single();

      if (pError) throw pError;

      // 2. Crear los dos personajes vinculados
      const initialCharacters = [
        {
          profile_id: userId,
          name: `Gutts`,
          character_class: 'Warrior',
          current_hp: 80,
          max_hp: 80,
          lvl: 1,
          exp: 0,
          last_modified: new Date().toISOString()
        },
        {
          profile_id: userId,
          name: `Merlin`,
          character_class: 'Mage',
          current_hp: 80,
          max_hp: 80,
          lvl: 1,
          exp: 0,
          last_modified: new Date().toISOString()
        }
      ];

      const { data: chars, error: cError } = await this.supabase
        .from('characters')
        .insert(initialCharacters)
        .select();

      if (cError) throw cError;

      // 3. Mapear todo a tu estado local (Mapa Hash)
      const fullState = {
        ...profile,
        characters: this.arrayToHash(chars),
        last_modified_local: new Date().toISOString()
      };

      // Guardar en Storage Local inmediatamente
      await this.storageService.set('user_data', profile);
      await this.storageService.set('characters', fullState.characters);
      await this.storageService.set('last_modified_local', fullState.last_modified_local);

      console.log('soy el fullstate', fullState)
      return fullState;

    } catch (error) {
      console.error('Error creando cuenta completa:', error);
      return null;
    }
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

  // --- SAVE / LOAD GAME DATA ---

  async saveGameData(playerState: Partial<{ coins: number; specialCoins: number; exp: number; lvl: number }>, _inventory: any): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');

    if (Object.keys(playerState).length === 0) return;

    // Mapea los nombres del modelo al esquema de la tabla
    const row: Record<string, any> = { last_modified: new Date().toISOString() };
    if (playerState.coins         !== undefined) row['coins']         = playerState.coins;
    if (playerState.specialCoins  !== undefined) row['special_coins'] = playerState.specialCoins;
    if (playerState.exp           !== undefined) row['exp']           = playerState.exp;
    if (playerState.lvl           !== undefined) row['lvl']           = playerState.lvl;

    const { error } = await this.supabase
      .from('global_data')
      .update(row)
      .eq('id', user.id);

    if (error) throw error;
    // Inventario: pendiente de tabla propia en Supabase
  }

  async loadGameData(): Promise<{ playerState: any } | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from('global_data')
      .select('coins, special_coins, exp, lvl')
      .eq('id', user.id)
      .single();

    if (error || !data) return null;
    return { playerState: data };
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