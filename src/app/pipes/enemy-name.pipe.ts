import { Pipe, PipeTransform } from '@angular/core';
import { ENEMY_REGISTRY } from '../enemy/enemy-config';

@Pipe({ name: 'enemyName', standalone: false })
export class EnemyNamePipe implements PipeTransform {
  transform(type: string): string {
    return ENEMY_REGISTRY[type]?.displayName ?? type;
  }
}
