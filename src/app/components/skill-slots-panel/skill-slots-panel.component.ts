import { Component, inject, OnInit } from '@angular/core';
import { TalentService, TalentNodeConfig, TALENT_NODES_FIRE, TALENT_NODES_WATER } from 'src/app/services/talent.service';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { SKILL_REGISTRY } from 'src/app/services/skill-config';
import { PanelStateService } from 'src/app/services/panel-state.service';
import { HudSkillSlotsService } from 'src/app/services/hud-skill-slots.service';

export type SkillTab = 'fire' | 'water' | 'other';

const FIRE_IDS  = new Set(TALENT_NODES_FIRE.map(n => n.id));
const WATER_IDS = new Set(TALENT_NODES_WATER.map(n => n.id));

@Component({
  selector: 'app-skill-slots-panel',
  templateUrl: './skill-slots-panel.component.html',
  styleUrls: ['./skill-slots-panel.component.scss'],
  standalone: false
})
export class SkillSlotsPanelComponent implements OnInit {
  private talentService     = inject(TalentService);
  private skillEquipService = inject(SkillEquipService);
  private panelState        = inject(PanelStateService);
  private hudSlots          = inject(HudSkillSlotsService);

  activeTab: SkillTab = 'fire';

  ngOnInit(): void {
    this.activeTab = this.panelState.get<SkillTab>('skillSlots.tab', 'fire');
  }

  get abilities(): TalentNodeConfig[] {
    const all = this.talentService.nodes.filter(n => n.effect.type === 'ability');
    if (this.activeTab === 'fire')  return all.filter(n => FIRE_IDS.has(n.id));
    if (this.activeTab === 'water') return all.filter(n => WATER_IDS.has(n.id));
    return all.filter(n => !FIRE_IDS.has(n.id) && !WATER_IDS.has(n.id));
  }

  get selectedId(): string | null {
    return this.skillEquipService.selectedAbilityId;
  }

  setTab(tab: SkillTab) {
    this.activeTab = tab;
    this.panelState.set('skillSlots.tab', tab);
  }

  iconOf(ability: TalentNodeConfig): string | null {
    return SKILL_REGISTRY[ability.effect.ability ?? '']?.iconPath ?? null;
  }


  select(ability: TalentNodeConfig) {
    this.skillEquipService.selectedAbilityId = ability.id;
    this.skillEquipService.openDetail$.next(ability.id);
  }

  get isHudSlot(): boolean {
    return (this.skillEquipService.activeSlot ?? 0) < 0;
  }

  get hudSlotFilled(): boolean {
    const slot = this.skillEquipService.activeSlot;
    if (!this.isHudSlot || slot == null) return false;
    const index = Math.abs(slot) - 1;
    return !!this.hudSlots.slots[index];
  }

  clearSlot(): void {
    const slot = this.skillEquipService.activeSlot;
    if (!this.isHudSlot || slot == null) return;
    const index = Math.abs(slot) - 1;
    this.hudSlots.set(index, null);
    this.skillEquipService.closeSkillPanels$.next();
  }
}
