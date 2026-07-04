/**
 * LaserCannon.ts
 * ------------------------------------------------------------
 * 雷射砲：直線穿透、單發高破壞力，但射擊間隔長。
 * 射出一發高速的穿透彈（piercing），可貫穿並傷害路徑上多個敵人。
 * ------------------------------------------------------------
 */

import { Weapon, FireContext } from './Weapon';
import { ProjectileKind } from './ProjectileManager';

export class LaserCannon extends Weapon {
  public fire(ctx: FireContext): void {
    ctx.projectiles.spawn({
      kind: ProjectileKind.Laser,
      origin: ctx.origin.clone(),
      direction: ctx.direction.clone(),
      speed: this.spec.projectileSpeed,
      damage: this.spec.damage,
      piercing: true, // 穿透：不會因命中而消失，可傷害多個敵人
      homing: false,
      target: null,
    });

    this.applyCost();
  }
}
