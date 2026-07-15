
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { GameApiService } from 'src/app/services/game-api.service';
import { StorageService } from 'src/app/services/storage.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { ConnectionService } from 'src/app/services/connection.service';
import { AdminService } from 'src/app/services/admin.service';
import { APP_VERSION } from 'src/app/version';

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
    /** Toggle: true = modo admin (todo desbloqueado) · false = juego normal (oculta lo no desbloqueado). */
    admin = true;
    readonly appVersion = APP_VERSION;

    constructor(
        private router: Router,
        private api: GameApiService,
        private storageService: StorageService,
        private supabaseService: SupabaseService,
        private connection: ConnectionService,
        private adminService: AdminService,
        private translate: TranslateService,
    ) { }

    async ngOnInit() {
        await this.connection.load();
        this.useSupabase = this.connection.useSupabase;
        this.admin = this.adminService.isAdmin;

        // Auto-entrada: si ya hay una sesión de Supabase persistida (invitado o cuenta
        // con email), el jugador nunca "inició sesión" de nuevo — la revivimos y entramos
        // directos, saltándonos el login. Solo aplica en modo Supabase.
        if (this.useSupabase && await this.supabaseService.hasSession()) {
            if (await this.supabaseService.isBanned()) {
                await this.supabaseService.signOut();
                this.error = this.translate.instant('LOGIN.ERR.BANNED');
                return;
            }
            this.router.navigate(['/globalposition']);
        }
    }

    /** Entra como INVITADO: crea (o revive) una cuenta anónima y va al juego.
     *  Fuerza modo Supabase para que la sesión anónima se sincronice y persista. */
    async loginAsGuest() {
        if (this.loading) return;
        this.error = '';
        this.loading = true;
        try {
            await this.connection.setUseSupabase(true);
            this.adminService.setAdmin(this.admin);

            const { error } = await this.supabaseService.signInAnonymously();
            if (error) {
                // El error típico aquí es "Anonymous sign-ins are disabled" (dashboard).
                this.error = error.message;
                return;
            }
            this.router.navigate(['/globalposition']);
        } catch (e: any) {
            this.error = e?.message ?? this.translate.instant('LOGIN.ERR.CONNECTION');
        } finally {
            this.loading = false;
        }
    }

    async login() {
        if (this.loading) return;
        this.error = '';

        // Persiste el modo elegido (lo respeta el botón Guardar dentro del juego).
        await this.connection.setUseSupabase(this.useSupabase);
        // Persiste el modo admin (lo lee TalentService/paneles para mostrar u ocultar lo no desbloqueado).
        this.adminService.setAdmin(this.admin);

        // Modo local: sin autenticación, directo al juego (datos solo en local).
        if (!this.useSupabase) {
            this.router.navigate(['/globalposition']);
            return;
        }

        const email = this.email.trim();
        const password = this.password;
        if (!email || !password) {
            this.error = this.translate.instant('LOGIN.ERR.CREDENTIALS');
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
                    this.error = this.translate.instant('LOGIN.ERR.CONFIRM_EMAIL');
                    return;
                }
                ({ error } = await this.supabaseService.signIn(email, password));
            }

            if (error) { this.error = error.message; return; }

            // 2.5. Comprobar BANEO: el panel de admin marca account.banned.
            //      Cuenta baneada → cerrar sesión y bloquear el acceso.
            if (await this.supabaseService.isBanned()) {
                await this.supabaseService.signOut();
                this.error = this.translate.instant('LOGIN.ERR.BANNED');
                return;
            }

            // 3. Sesión activa + datos en local → al juego
            this.router.navigate(['/globalposition']);
        } catch (e: any) {
            this.error = e?.message ?? this.translate.instant('LOGIN.ERR.CONNECTION');
        } finally {
            this.loading = false;
        }
    }

}
