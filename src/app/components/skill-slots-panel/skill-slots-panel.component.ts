import { Component, inject } from '@angular/core';
import { TalentService, TalentNodeConfig } from 'src/app/services/talent.service';

@Component({
  selector: 'app-skill-slots-panel',
  templateUrl: './skill-slots-panel.component.html',
  styleUrls: ['./skill-slots-panel.component.scss'],
  standalone: false
})
export class SkillSlotsPanelComponent {
  private talentService = inject(TalentService);

  get abilities(): TalentNodeConfig[] {
    return this.talentService.nodes.filter(
      n => n.effect.type === 'ability' && this.talentService.slotted[n.id] != null
    );
  }
}
