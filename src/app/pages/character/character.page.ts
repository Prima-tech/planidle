import { Component, OnInit } from '@angular/core';
import { AsgardService } from 'src/app/services/asgard';

@Component({
  selector: 'app-character-sheet',
  templateUrl: './character.page.html',
  styleUrls: ['./character.page.scss'],
  standalone: false,
})
export class CharacterPageComponent implements OnInit {
  activeTab = 0;
  character: any = null;

  private readonly CLASS_ICONS: Record<string, string> = {
    Warrior:   'shield-outline',
    Mage:      'flash-outline',
    Hunter:    'scan-outline',
    Priest:    'heart-outline',
    Necron:    'skull-outline',
    Ancestral: 'infinite-outline',
  };

  constructor(private asgardService: AsgardService) {}

  async ngOnInit() {
    this.character = await this.asgardService.getSelectedPlayer();
  }

  get classIcon(): string {
    return this.CLASS_ICONS[this.character?.character_class] ?? 'person-outline';
  }
}
