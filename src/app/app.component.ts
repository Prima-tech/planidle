import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { GameSettingsService } from './services/game-settings.service';
import { AppStyleService } from './services/app-style.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private translate: TranslateService,
    private settings: GameSettingsService,
    // Instanciar el servicio de estilo al arrancar aplica data-appstyle en <html>
    // antes de pintar nada (evita parpadeo del tema).
    private appStyle: AppStyleService,
  ) {
    this.initApp();
  }


  initApp() {
    // Idiomas disponibles + fallback. El idioma activo se lee de los ajustes
    // (persistido en localStorage); el selector de ajustes lo cambia en caliente.
    this.translate.addLangs(['en', 'es']);
    this.translate.setDefaultLang('es');
    this.translate.use(this.settings.language);
  }
}
