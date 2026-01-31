export class Character {
  private _character_class: string;
  private _current_hp: number;
  private _equipment: any;
  private _experience_points: number;
  private _id: number;
  private _max_hp: number;
  private _name: string;
  private _profile_id: string;

  constructor(data: any) {
    if (data) {
      this.character_class = data.character_class;
      this.current_hp = data.current_hp;
      this.equipment = data.equipment;
      this.experience_points = data.experience_points;
      this.id = data.id;
      this.max_hp = data.max_hp;
      this.name = data.name;
      this.profile_id = data.profile_id;
    }
  }

  get character_class(): string {
    return this._character_class;
  }

  set character_class(value: string) {
    this._character_class = value;
  }

  get current_hp(): number {
    return this._current_hp;
  }

  set current_hp(value: number) {
    this._current_hp = value;
  }

  get equipment(): any {
    return this._equipment;
  }

  set equipment(value: any) {
    this._equipment = value;
  }

  get experience_points(): number {
    return this._experience_points;
  }

  set experience_points(value: number) {
    this._experience_points = value;
  }

  get id(): number {
    return this._id;
  }

  set id(value: number) {
    this._id = value;
  }

  get max_hp(): number {
    return this._max_hp;
  }

  set max_hp(value: number) {
    this._max_hp = value;
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get profile_id(): string {
    return this._profile_id;
  }

  set profile_id(value: string) {
    this._profile_id = value;
  }
}