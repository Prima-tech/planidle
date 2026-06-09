import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { HudSkillSlotsService } from 'src/app/services/hud-skill-slots.service';
import { TalentService, SPHERE_MULT } from 'src/app/services/talent.service';
import { SkillActivationService } from 'src/app/services/skill-activation.service';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { SKILL_REGISTRY } from 'src/app/services/skill-config';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { SkillSlotsPanelComponent } from '../skill-slots-panel/skill-slots-panel.component';

@Component({
  selector: 'app-hud-skill-buttons',
  templateUrl: './hud-skill-buttons.component.html',
  styleUrls: ['./hud-skill-buttons.component.scss'],
  standalone: false,
})
export class HudSkillButtonsComponent implements OnInit, OnDestroy {
  @ViewChild('hudModal') hudModal!: ModalContainerComponent;

  private hudSlots        = inject(HudSkillSlotsService);
  private talentService   = inject(TalentService);
  private skillActivation = inject(SkillActivationService);
  private skillEquip      = inject(SkillEquipService);

  readonly slots = this.hudSlots.slots;
  readonly INDICES = [0, 1, 2] as const;

  cdAngles:  number[] = [0, 0, 0];
  cdSeconds: string[] = ['', '', ''];

  private cdInterval: ReturnType<typeof setInterval> | null = null;
  private longPressTimer: any = null;
  private subs: Subscription[] = [];

  ngOnInit(): void {
    // Cuando se equipa desde SkillDetailComponent con slot negativo → asignar al HUD
    this.subs.push(
      this.skillEquip.hudEquip$.subscribe(({ index, nodeId }) => {
        this.hudSlots.set(index, nodeId);
      })
    );
    // Cerrar el modal del HUD cuando el sistema cierra todos los paneles de skills
    this.subs.push(
      this.skillEquip.closeSkillPanels$.subscribe(() => {
        if (this.hudModal?.isOpenModal()) this.hudModal.close();
      })
    );
    this.startCdLoop();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.cdInterval) clearInterval(this.cdInterval);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
  }

  // ── Iconos ───────────────────────────────────────────────────────────────────

  iconOf(index: number): string | null {
    const node = this.nodeAt(index);
    return SKILL_REGISTRY[node?.effect?.ability ?? '']?.iconPath ?? null;
  }

  ionIconOf(index: number): string | null {
    return this.nodeAt(index)?.icon ?? null;
  }

  private nodeAt(index: number) {
    const nodeId = this.slots[index];
    return nodeId ? this.talentService.nodes.find(n => n.id === nodeId) : null;
  }

  // ── Touch ────────────────────────────────────────────────────────────────────

  onTouchStart(index: number): void {
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.openPicker(index);
    }, 450);
  }

  onTouchEnd(index: number): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
      this.slots[index] ? this.activate(index) : this.openPicker(index);
    }
  }

  onTouchCancel(): void {
    if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
  }

  // ── Picker ───────────────────────────────────────────────────────────────────

  openPicker(index: number): void {
    this.skillEquip.activeSlot = -(index + 1);
    if (this.hudModal.isOpenModal()) this.hudModal.close();
    this.hudModal.open(SkillSlotsPanelComponent, 'skill-slots');
  }

  // ── Activación ───────────────────────────────────────────────────────────────

  private activate(index: number): void {
    const node = this.nodeAt(index);
    if (!node?.effect?.ability) return;
    const sphere = this.talentService.slotted[node.id];
    const damage = node.effect.base * (sphere ? SPHERE_MULT[sphere] : 1);
    this.skillActivation.request(node.effect.ability, damage);
    this.startCdLoop();
  }

  noTarget(index: number): boolean {
    const ability = this.nodeAt(index)?.effect?.ability;
    return !!ability && this.cdAngles[index] === 0 && !this.skillActivation.hasTarget(ability);
  }

  // ── Cooldown ─────────────────────────────────────────────────────────────────

  private startCdLoop(): void {
    if (this.cdInterval) return;
    this.cdInterval = setInterval(() => {
      let anyActive = false;
      for (let i = 0; i < 3; i++) {
        const ability = this.nodeAt(i)?.effect?.ability ?? null;
        if (!ability) { this.cdAngles[i] = 0; this.cdSeconds[i] = ''; continue; }
        const ratio = this.skillActivation.cooldownRatio(ability);
        const secs  = this.skillActivation.cooldownRemaining(ability);
        this.cdAngles[i]  = ratio * 360;
        this.cdSeconds[i] = secs > 0 ? (secs >= 1 ? String(Math.ceil(secs)) : secs.toFixed(1)) : '';
        if (ratio > 0) anyActive = true;
      }
      if (!anyActive) { clearInterval(this.cdInterval!); this.cdInterval = null; }
    }, 50);
  }
}
