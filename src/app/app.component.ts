import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private translate: TranslateService) {
    this.initApp();
  }


  initApp() {
    console.log('init app');

    // Configurar idiomas disponibles
    this.translate.addLangs(['en', 'es']);

    // Establecer idioma por defecto
    this.translate.setDefaultLang('es');

    // Usar español como idioma inicial
    this.translate.use('es');
  }
}
