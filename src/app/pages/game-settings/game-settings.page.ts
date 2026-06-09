import { Component } from '@angular/core';

@Component({
  selector: 'app-game-settings-page',
  templateUrl: './game-settings.page.html',
  styleUrls: ['./game-settings.page.scss'],
  standalone: false
})
export class GameSettingsPageComponent {
  tab: 0 | 1 | 2 = 0;
}
