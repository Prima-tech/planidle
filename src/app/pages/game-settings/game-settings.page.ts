import { Component, inject } from '@angular/core';
import { GameSettingsService } from 'src/app/services/game-settings.service';

@Component({
  selector: 'app-game-settings-page',
  templateUrl: './game-settings.page.html',
  styleUrls: ['./game-settings.page.scss'],
  standalone: false
})
export class GameSettingsPageComponent {
  tab: 0 | 1 | 2 = 0;
  gs = inject(GameSettingsService);
}
