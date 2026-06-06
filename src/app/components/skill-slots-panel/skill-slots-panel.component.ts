import { Component, inject } from '@angular/core';
import { TalentService, TalentNodeConfig } from 'src/app/services/talent.service';
import { SkillEquipService } from 'src/app/services/skill-equip.service';

@Component({
  selector: 'app-skill-slots-panel',
  templateUrl: './skill-slots-panel.component.html',
  styleUrls: ['./skill-slots-panel.component.scss'],
  standalone: false
})
export class SkillSlotsPanelComponent {
  private talentService     = inject(TalentService);
  private skillEquipService = inject(SkillEquipService);

  get abilities(): TalentNodeConfig[] {
    return this.talentService.nodes.filter(n => n.effect.type === 'ability');
  }

  get selectedId(): string | null {
    return this.skillEquipService.selectedAbilityId;
  }

  select(ability: TalentNodeConfig) {
    this.skillEquipService.selectedAbilityId = ability.id;
    this.skillEquipService.openDetail$.next(ability.id);
  }
}
