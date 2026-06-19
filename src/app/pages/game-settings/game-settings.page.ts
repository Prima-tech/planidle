import { Component, inject } from '@angular/core';
import { GameSettingsService } from 'src/app/services/game-settings.service';
import { PARALLAX_THEME_LIST } from 'src/app/scenes/gamescene/parallax-themes';
import { WORLD_PARALLAX_SETS } from 'src/app/scenes/worldrun/parallax-sets';
import { APP_VERSION } from 'src/app/version';

@Component({
  selector: 'app-game-settings-page',
  templateUrl: './game-settings.page.html',
  styleUrls: ['./game-settings.page.scss'],
  standalone: false
})
export class GameSettingsPageComponent {
  tab: 0 | 1 | 2 = 0;
  gs = inject(GameSettingsService);
  readonly appVersion = APP_VERSION;
  readonly parallaxThemes = PARALLAX_THEME_LIST;
  readonly worldParallaxSets = WORLD_PARALLAX_SETS;
}
