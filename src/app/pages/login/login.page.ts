
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameApiService } from 'src/app/services/game-api.service';
import { StorageService } from 'src/app/services/storage.service';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.scss'],
    standalone: false,
})
export class LoginPage implements OnInit {
    email = '';
    password = '';

    constructor(
        private router: Router,
        private api: GameApiService,
        private storageService: StorageService,
        private supabaseService: SupabaseService
    ) { }

    ngOnInit() {
    }

    async login() {
        let email = 'test@gmail.com';
        let password = '1234'
        const { data, error } = await this.supabaseService.signIn(email, password);
        if (error) {
            console.error('Login error:', error.message);
        } else {
            console.log('Login successful! Data synced and saved locally.');
            this.router.navigate(['/globalposition']);
        }
    }

}
