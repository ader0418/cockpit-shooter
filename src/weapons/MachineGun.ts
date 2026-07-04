/**
 * MachineGun.ts
 * ------------------------------------------------------------
 * 機關槍：射速快、單發傷害低、無限彈藥、無實質冷卻。
 * 開火時射出一發子彈，並加上些微隨機散布，讓連射有「掃射感」。
 * ------------------------------------------------------------
 */

import { Weapon, FireContext } from './Weapon';
import { ProjectileKind } from './ProjectileManager';
import { randRange } from '../utils/MathUtils';

export class MachineGun extends Weapon {
  /** 散布角度（弧度）：越大子彈越發散 */
  private readonly spread = 0.015;

  public fire(ctx: FireContext): void {
    // 在原始方向上加入微小隨機偏移，形成散布
    const dir = ctx.direction.clone();
    dir.x += randRange(-this.spread, this.spread);
    dir.y += randRange(-this.spread, this.spread);
    dir.normalize();

    ctx.projectiles.spawn({
      kind: ProjectileKind.Bullet,
      origin: ctx.origin.clone(),
      direction: dir,
      speed: this.spec.projectileSpeed,
      damage: this.spec.damage,
      piercing: false,
      homing: false,
      target: null,
    });

    // 消耗冷卻（機關槍冷卻極短，故連射流暢）
    this.applyCost();
  }
}
