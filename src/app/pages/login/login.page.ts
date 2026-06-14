
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameApiService } from 'src/app/services/game-api.service';
import { StorageService } from 'src/app/services/storage.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { ConnectionService } from 'src/app/services/connection.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.scss'],
    standalone: false,
})
export class LoginPage implements OnInit {
    email = '';
    password = '';
    loading = false;
    error = '';
    /** Toggle: true = conectar a Supabase · false = jugar en local. */
    useSupabase = false;

    constructor(
        private router: Router,
        private api: GameApiService,
        private storageService: StorageService,
        private supabaseService: SupabaseService,
        private connection: ConnectionService,
    ) { }

    async ngOnInit() {
        await this.connection.load();
        this.useSupabase = this.connection.useSupabase;
    }

    async login() {
        if (this.loading) return;
        this.error = '';

        // Persiste el modo elegido (lo respeta el botón Guardar dentro del juego).
        await this.connection.setUseSupabase(this.useSupabase);

        // Modo local: sin autenticación, directo al juego (datos solo en local).
        if (!this.useSupabase) {
            this.router.navigate(['/globalposition']);
            return;
        }

        const email = this.email.trim();
        const password = this.password;
        if (!email || !password) {
            this.error = 'Introduce email y contraseña';
            return;
        }

        this.loading = true;
        try {
            // 1. Intenta iniciar sesión (esto dispara fetchAndSaveLocalData)
            let { error } = await this.supabaseService.signIn(email, password);

            // 2. Si las credenciales no existen, crea la cuenta y reintenta.
            //    (requiere que "Confirm email" esté DESACTIVADO en Supabase Auth)
            if (error && /invalid login credentials/i.test(error.message)) {
                const { data, error: signUpError } = await this.supabaseService.signUp(email, password);
                if (signUpError) { this.error = signUpError.message; return; }
                // Sin sesión tras el alta → "Confirm email" está activado en Supabase
                if (!data?.session) {
                    this.error = 'Cuenta creada: confirma el correo o desactiva "Confirm email" en Supabase';
                    return;
                }
                ({ error } = await this.supabaseService.signIn(email, password));
            }

            if (error) { this.error = error.message; return; }

            // 3. Sesión activa + datos en local → al juego
            this.router.navigate(['/globalposition']);
        } catch (e: any) {
            this.error = e?.message ?? 'Error de conexión';
        } finally {
            this.loading = false;
        }
    }

}
