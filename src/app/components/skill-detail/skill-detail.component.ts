import { Component, inject } from '@angular/core';
import { TalentService, TalentNodeConfig } from 'src/app/services/talent.service';
import { SkillEquipService } from 'src/app/services/skill-equip.service';

@Component({
  selector: 'app-skill-detail',
  templateUrl: './skill-detail.component.html',
  styleUrls: ['./skill-detail.component.scss'],
  standalone: false
})
export class SkillDetailComponent {
  private talentService     = inject(TalentService);
  private skillEquipService = inject(SkillEquipService);

  get ability(): TalentNodeConfig | null {
    const id = this.skillEquipService.selectedAbilityId;
    return id ? (this.talentService.nodes.find(n => n.id === id) ?? null) : null;
  }

  get activeSlot(): number | null {
    return this.skillEquipService.activeSlot;
  }

  equip() {
    const slot = this.activeSlot;
    const id   = this.skillEquipService.selectedAbilityId;
    if (!slot || !id) return;
    this.skillEquipService.equip(slot, id);
  }
}
