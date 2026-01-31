import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './storage.service';

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    private supabase: SupabaseClient;

    constructor(private storageService: StorageService) {
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
        // Parallel requests for better performance
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
}