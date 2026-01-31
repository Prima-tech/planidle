
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameApiService } from 'src/app/services/game-api.service';
import { StorageService } from 'src/app/services/storage.service';

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
        private storageService: StorageService
    ) { }

    ngOnInit() {
    }

    async login() {
        await this.storageService.set('nombre_usuario', 'Victor_Prueba');
        console.log('Dato guardado en Storage');

        // 2. Lo recuperamos inmediatamente
        let data = await this.storageService.get('nombre_usuario');
        console.log('Dato recuperado del Storage:', data);
        /*
        console.log('Login attempt', this.email, this.password);
        try {
            const data = await this.api.loadData();
            console.log('soy la data bro', data);
            this.router.navigate(['/globalposition']);
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
            */
    }

}
