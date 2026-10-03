
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { GameApiService } from 'src/app/services/game-api.service';
import { StorageService } from 'src/app/services/storage.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { ConnectionService } from 'src/app/services/connection.service';
import { AdminService } from 'src/app/services/admin.service';
import { SaveService } from 'src/app/services/save.service';
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
    // Por defecto, Supabase (ngOnInit lo pisa con lo guardado, si hay algo).
    useSupabase = true;
    /** Vista del toggle "Local": ON = jugar en local (inverso de useSupabase). */
    get localMode(): boolean { return !this.useSupabase; }
    set localMode(v: boolean) { this.useSupabase = !v; }
    /** Toggle: true = modo admin (todo desbloqueado) · false = juego normal (oculta lo no desbloqueado). */
    admin = false;
    readonly appVersion = APP_VERSION;
    /** ID de la sesión de invitado local pendiente de reanudar (tras cerrar sesión). Si
     *  no es null, el botón de invitado pasa a "Continuar como invitado (ID)". */
    guestId: string | null = null;

    constructor(
        private router: Router,
        private toastCtrl: ToastController,
        private api: GameApiService,
        private storageService: StorageService,
        private supabaseService: SupabaseService,
        private connection: ConnectionService,
        private adminService: AdminService,
        private saveService: SaveService,
        private translate: TranslateService,
    ) { }

    async ngOnInit() {
        await this.connection.load();
        this.useSupabase = this.connection.useSupabase;
        this.admin = this.adminService.isAdmin;

        // Auto-entrada: si hay una sesión VÁLIDA (confirmada por el servidor), el jugador
        // nunca "inició sesión" de nuevo — la revivimos y entramos directos, saltándonos
        // el login. La autenticación requiere red: sin conexión, o si la cuenta ya no
        // existe (p. ej. wipe del admin), hasValidServerSession() da false → se queda en
        // el login en vez de entrar como un "invitado fantasma" con datos locales.
        const skipAuto = await this.connection.consumeAutoLoginSuppression();
        if (!skipAuto && this.useSupabase && await this.supabaseService.hasValidServerSession()) {
            if (await this.blockIfRestricted()) return;
            this.router.navigate(['/globalposition']);
            return;
        }

        // No hubo auto-entrada: ¿hay una sesión de invitado local que reanudar? (queda
        // viva tras "Cerrar sesión" porque el invitado no tiene credenciales con que
        // volver). Si la hay, el botón ofrecerá "Continuar como invitado (ID)".
        this.guestId = await this.supabaseService.getLocalGuestId();
    }

    /** Cuenta con acceso BLOQUEADO (baneada por el admin, o soft-delete de "Borrar
     *  cuenta (nube)"): cierra la sesión, pinta el error y devuelve true. Se comprueba
     *  en TODAS las vías de entrada (auto-entrada, invitado y email). */
    private async blockIfRestricted(): Promise<boolean> {
        const block = await this.supabaseService.accessBlock();
        if (!block) return false;
        await this.supabaseService.signOut();
        this.guestId = null;
        this.error = this.translate.instant('LOGIN.ERR.BANNED');
        return true;
    }

    /** Reanuda la MISMA cuenta invitada guardada localmente: valida contra el servidor
     *  (requiere red), reactiva el modo Supabase y entra SIN crear otra cuenta ni borrar
     *  el progreso. */
    async resumeGuest() {
        if (this.loading) return;
        this.error = '';
        this.loading = true;
        try {
            if (!await this.supabaseService.hasValidServerSession()) {
                // Sin red, o la cuenta invitada ya no existe (p. ej. wipe del admin).
                this.error = this.translate.instant('LOGIN.ERR.CONNECTION');
                return;
            }
            if (await this.blockIfRestricted()) return;
            await this.connection.setUseSupabase(true);
            this.adminService.setAdmin(this.admin);
            this.router.navigate(['/globalposition']);
        } catch (e: any) {
            this.error = e?.message ?? this.translate.instant('LOGIN.ERR.CONNECTION');
        } finally {
            this.loading = false;
        }
    }

    /** Entra como INVITADO: crea (o revive) una cuenta anónima y va al juego.
     *  Fuerza modo Supabase para que la sesión anónima se sincronice y persista. */
    async loginAsGuest() {
        if (this.loading) return;
        this.error = '';
        this.loading = true;
        try {
            // 1. Crear la cuenta invitada (anónima). Si el alta falla (p. ej. "Anonymous
            //    sign-ins disabled"), NO tocamos nada local: el usuario conserva sus datos.
            const { data, error } = await this.supabaseService.signInAnonymously();
            if (error) {
                this.error = error.message;
                return;
            }

            // 2. Alta OK → empezar LIMPIO. Una cuenta invitada nueva no debe heredar datos
            //    locales previos del dispositivo (p. ej. una partida en modo local, con IDs
            //    negativos y equipo puesto). Borramos el local y repoblamos el roster fresco
            //    de la cuenta recién creada. (El re-fetch cubre también el caso en que el
            //    fetch interno de signInAnonymously fallara y dejara el roster viejo.)
            await this.saveService.wipeAllData();
            await this.connection.setUseSupabase(true);   // re-fija el modo tras el wipe
            this.adminService.setAdmin(this.admin);         // re-fija admin tras el wipe
            if (data?.user) await this.supabaseService.fetchAndSaveLocalData(data.user.id);

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
            let accountCreated = false;

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
                accountCreated = true;
                ({ error } = await this.supabaseService.signIn(email, password));
            }

            if (error) { this.error = error.message; return; }

            // 2.5. Cuenta bloqueada (baneo del admin o soft-delete) → cerrar sesión
            //      y bloquear el acceso.
            if (await this.blockIfRestricted()) return;

            // Alta nueva → toast verde "Cuenta creada" (overlay de Ionic: sobrevive a la navegación).
            if (accountCreated) this.showAccountCreatedToast();

            // 3. Sesión activa + datos en local → al juego
            this.router.navigate(['/globalposition']);
        } catch (e: any) {
            this.error = e?.message ?? this.translate.instant('LOGIN.ERR.CONNECTION');
        } finally {
            this.loading = false;
        }
    }

    /** Toast de confirmación tras crear la cuenta (pequeño, arriba-izquierda). */
    private async showAccountCreatedToast(): Promise<void> {
        const toast = await this.toastCtrl.create({
            message: this.translate.instant('LOGIN.ACCOUNT_CREATED'),
            icon: 'checkmark-circle',
            cssClass: 'toast-account-created',   // estilo en global.scss
            position: 'top',
            duration: 2500,
        });
        await toast.present();
    }

}
