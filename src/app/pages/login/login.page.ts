
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameApiService } from 'src/app/services/game-api.service';

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
    ) { }

    ngOnInit() {
    }

    async login() {
        console.log('Login attempt', this.email, this.password);
        try {
            const data = await this.api.loadData();
            console.log('soy la data bro', data);
            this.router.navigate(['/globalposition']);
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    }

}
