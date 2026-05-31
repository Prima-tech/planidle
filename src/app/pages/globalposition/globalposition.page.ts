import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AsgardService } from 'src/app/services/asgard';
import { StorageService } from 'src/app/services/storage.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { MAP_REGISTRY } from 'src/app/scenes/gamescene/map-config';

@Component({
  selector: 'app-globalposition',
  templateUrl: './globalposition.page.html',
  styleUrls: ['./globalposition.page.scss'],
  standalone: false,
})
export class GlobalpositionPage implements OnInit, OnDestroy {
  isSelected: any = null;
  charMapNames: Record<string, string> = {};
  charLastSeen: Record<string, string> = {};
  now = Date.now();
  private ticker: any;

  private readonly CLASS_ICONS: Record<string, string> = {
    Warrior:   'shield-outline',
    Mage:      'flash-outline',
    Hunter:    'scan-outline',
    Priest:    'heart-outline',
    Necron:    'skull-outline',
    Ancestral: 'infinite-outline',
  };

  // Row 1 = indexes 0-4, Row 2 = 5-9, Row 3 = 10
  get row1(): any[] { return this.sorted.slice(0, 5); }
  get row2(): any[] { return this.sorted.slice(5, 10); }
  get row3(): any[] { return this.sorted.slice(10, 11); }

  private get sorted(): any[] {
    const chars = this.asgardService._characters;
    if (!chars || !Array.isArray(chars)) return [];
    const order = SupabaseService.ROSTER_TEMPLATE.map(t => t.name);
    return [...chars].sort((a, b) => {
      const ai = order.indexOf(a.name);
      const bi = order.indexOf(b.name);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  constructor(
    private router: Router,
    public asgardService: AsgardService,
    private storageService: StorageService,
    private supabaseService: SupabaseService
  ) { }

  async ngOnInit() {
    await this.asgardService.refreshData();
    await this.fillLocalRosterIfIncomplete();
    await this.loadCharacterMaps();
    this.ticker = setInterval(() => this.now = Date.now(), 1000);
  }

  ngOnDestroy() {
    clearInterval(this.ticker);
  }

  private async loadCharacterMaps(): Promise<void> {
    const chars = this.asgardService._characters;
    if (!Array.isArray(chars)) return;
    for (const char of chars) {
      const snapshot = await this.storageService.get(`snapshot_char_${char.id}`);
      const mapId = snapshot?.mapId ?? 'hogar';
      this.charMapNames[char.id] = MAP_REGISTRY[mapId]?.name ?? mapId;

      if (snapshot?.lastSeen) {
        this.charLastSeen[char.id] = snapshot.lastSeen;
      } else {
        // Personaje nunca jugado: guardar la primera vez que se ve en selección
        const firstSeenKey = `first_seen_char_${char.id}`;
        let firstSeen: string = await this.storageService.get(firstSeenKey);
        if (!firstSeen) {
          firstSeen = new Date().toISOString();
          await this.storageService.set(firstSeenKey, firstSeen);
        }
        this.charLastSeen[char.id] = firstSeen;
      }
    }
  }

  timeSince(charId: string): string {
    const iso = this.charLastSeen[charId];
    if (!iso) return '...';
    const diff = this.now - new Date(iso).getTime();
    const totalSecs = Math.floor(diff / 1000);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  private async fillLocalRosterIfIncomplete() {
    const chars = this.asgardService._characters;
    const roster = SupabaseService.ROSTER_TEMPLATE;
    if (Array.isArray(chars) && chars.length >= roster.length) return;

    const existing: any[] = Array.isArray(chars) ? chars : [];
    const existingNames = new Set(existing.map((c: any) => c.name));
    let nextLocalId = -1;

    const missing = roster
      .filter(t => !existingNames.has(t.name))
      .map(t => ({
        id: nextLocalId--,
        name: t.name,
        character_class: t.character_class,
        current_hp: t.max_hp,
        max_hp: t.max_hp,
        lvl: 1,
        exp: 0,
        profile_id: null,
      }));

    const full = [...existing, ...missing];
    this.asgardService._characters = full;
    await this.storageService.set('characters', full);
  }

  async continue() {
    await this.asgardService.setSelectedPlayer(this.isSelected);
    this.router.navigate(['/main']);
  }

  selectPlayer(player: any) {
    this.isSelected = player;
  }

  getClassIcon(characterClass: string): string {
    return this.CLASS_ICONS[characterClass] ?? 'person-outline';
  }

  classKey(characterClass: string): string {
    return (characterClass ?? '').toLowerCase();
  }
}
