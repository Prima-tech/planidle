import { AsgardService } from '../services/asgard';
import { BuffService } from '../services/buff.service';
import { CharacterStatsService } from '../services/character-stats.service';
import { EquipmentService } from '../services/equipment.service';
import { InventoryService } from '../services/inventory.service';
import { KillService } from '../services/kill.service';
import { MapService } from '../services/map.service';
import { MapStatsService } from '../services/map-stats.service';
import { PlayerBridgeService } from '../services/player-bridge.service';
import { PlayerStateService } from '../services/player-state.service';
import { WorldService } from '../services/world.service';
import { SummonService } from '../services/summon.service';
import { SkillActivationService } from '../services/skill-activation.service';
import { AutoAttackService } from '../services/auto-attack.service';
import { GameSettingsService } from '../services/game-settings.service';
import { HudSkillSlotsService } from '../services/hud-skill-slots.service';
import { SkillEquipService } from '../services/skill-equip.service';
import { TalentService } from '../services/talent.service';
import { InteractionService } from '../services/interaction.service';
import { CityBuildService } from '../services/city-build.service';
import { GatheringEquipmentService } from '../services/gathering-equipment.service';
import { GatheringSkillsService } from '../services/gathering-skills.service';
import { UnlockService } from '../services/unlock.service';
import { ActivityService } from '../services/activity.service';
import { DialogueService } from '../services/dialogue.service';
import { ForgeService } from '../services/forge.service';
import { MapUpgradesService } from '../services/map-upgrades.service';
import { AdminService } from '../services/admin.service';

/** Claves del registro Phaser. Úsalas en registry.set() para evitar typos. */
export const REGISTRY_KEYS = {
  PLAYER_BRIDGE:    'playerBridgeService',
  WORLD:            'worldService',
  INVENTORY:        'inventoryService',
  PLAYER_STATE:     'playerStateService',
  KILL:             'killService',
  MAP:              'mapService',
  MAP_STATS:        'mapStatsService',
  EQUIPMENT:        'equipmentService',
  SUMMON:           'summonService',
  CHAR_STATS:       'characterStatsService',
  ASGARD:           'asgardService',
  SKILL_ACTIVATION: 'skillActivationService',
  BUFF:             'buffService',
  AUTO_ATTACK:      'autoAttackService',
  GAME_SETTINGS:    'gameSettingsService',
  HUD_SKILL_SLOTS:  'hudSkillSlotsService',
  SKILL_EQUIP:      'skillEquipService',
  TALENT:           'talentService',
  INTERACTION:      'interactionService',
  CITY_BUILD:       'cityBuildService',
  GATHERING:        'gatheringEquipmentService',
  GATHERING_SKILLS: 'gatheringSkillsService',
  UNLOCK:           'unlockService',
  ACTIVITY:         'activityService',
  DIALOGUE:         'dialogueService',
  FORGE:            'forgeService',
  MAP_UPGRADES:     'mapUpgradesService',
  ADMIN:            'adminService',
} as const;

/** Wrapper tipado sobre game.registry. Úsalo en preload() de cada escena. */
export class GameRegistry {
  constructor(private game: Phaser.Game) {}

  get playerBridge(): PlayerBridgeService    { return this.game.registry.get(REGISTRY_KEYS.PLAYER_BRIDGE); }
  get world():        WorldService           { return this.game.registry.get(REGISTRY_KEYS.WORLD); }
  get inventory():    InventoryService       { return this.game.registry.get(REGISTRY_KEYS.INVENTORY); }
  get playerState():  PlayerStateService     { return this.game.registry.get(REGISTRY_KEYS.PLAYER_STATE); }
  get kill():         KillService            { return this.game.registry.get(REGISTRY_KEYS.KILL); }
  get map():          MapService             { return this.game.registry.get(REGISTRY_KEYS.MAP); }
  get mapStats():     MapStatsService        { return this.game.registry.get(REGISTRY_KEYS.MAP_STATS); }
  get equipment():    EquipmentService       { return this.game.registry.get(REGISTRY_KEYS.EQUIPMENT); }
  get summon():       SummonService          { return this.game.registry.get(REGISTRY_KEYS.SUMMON); }
  get charStats():       CharacterStatsService    { return this.game.registry.get(REGISTRY_KEYS.CHAR_STATS); }
  get asgard():          AsgardService            { return this.game.registry.get(REGISTRY_KEYS.ASGARD); }
  get skillActivation(): SkillActivationService   { return this.game.registry.get(REGISTRY_KEYS.SKILL_ACTIVATION); }
  get buff():            BuffService              { return this.game.registry.get(REGISTRY_KEYS.BUFF); }
  get autoAttack():      AutoAttackService        { return this.game.registry.get(REGISTRY_KEYS.AUTO_ATTACK); }
  get gameSettings():    GameSettingsService      { return this.game.registry.get(REGISTRY_KEYS.GAME_SETTINGS); }
  get hudSlots():        HudSkillSlotsService     { return this.game.registry.get(REGISTRY_KEYS.HUD_SKILL_SLOTS); }
  get skillEquip():      SkillEquipService        { return this.game.registry.get(REGISTRY_KEYS.SKILL_EQUIP); }
  get talent():          TalentService            { return this.game.registry.get(REGISTRY_KEYS.TALENT); }
  get interaction():     InteractionService        { return this.game.registry.get(REGISTRY_KEYS.INTERACTION); }
  get cityBuild():       CityBuildService          { return this.game.registry.get(REGISTRY_KEYS.CITY_BUILD); }
  get gathering():       GatheringEquipmentService { return this.game.registry.get(REGISTRY_KEYS.GATHERING); }
  get gatheringSkills(): GatheringSkillsService    { return this.game.registry.get(REGISTRY_KEYS.GATHERING_SKILLS); }
  get unlocks():         UnlockService             { return this.game.registry.get(REGISTRY_KEYS.UNLOCK); }
  get activity():        ActivityService           { return this.game.registry.get(REGISTRY_KEYS.ACTIVITY); }
  get dialogue():        DialogueService           { return this.game.registry.get(REGISTRY_KEYS.DIALOGUE); }
  get forge():           ForgeService              { return this.game.registry.get(REGISTRY_KEYS.FORGE); }
  get mapUpgrades():     MapUpgradesService        { return this.game.registry.get(REGISTRY_KEYS.MAP_UPGRADES); }
  get admin():           AdminService              { return this.game.registry.get(REGISTRY_KEYS.ADMIN); }
}
