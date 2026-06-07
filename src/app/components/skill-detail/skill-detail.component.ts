import { Component, inject } from '@angular/core';
import { TalentService, TalentNodeConfig } from 'src/app/services/talent.service';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { SKILL_REGISTRY } from 'src/app/services/skill-config';

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

  get iconPath(): string | null {
    return SKILL_REGISTRY[this.ability?.effect.ability ?? '']?.iconPath ?? null;
  }

  private readonly STAT_LABELS: Record<string, string> = {
    defense: 'Defensa',
    attack:  'Ataque',
    hp:      'Vida',
    mp:      'Maná',
  };

  get powerLabel(): string {
    const cfg = SKILL_REGISTRY[this.ability?.effect.ability ?? ''];
    if (cfg?.effectType === 'buff' && cfg.buff) {
      const name = this.STAT_LABELS[cfg.buff.stat] ?? cfg.buff.stat;
      return `${name}: +${cfg.buff.value}`;
    }
    return `Poder base: ${this.ability?.effect.base ?? 0}`;
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
