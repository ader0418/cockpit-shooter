/**
 * HomingMissile.ts
 * ------------------------------------------------------------
 * 追蹤飛彈：射速慢、傷害高、有彈藥限制，能自動鎖定畫面上的敵機。
 *
 * 鎖定策略：從目標提供者拿到所有存活目標，挑一個「位於機首前方、
 * 且與瞄準方向夾角最小」的目標鎖定。若當下沒有合適目標，飛彈仍會
 * 射出，但直線飛行（不追蹤）。實際的弧線追蹤由 ProjectileManager 處理。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { Weapon, FireContext } from './Weapon';
import { ProjectileKind } from './ProjectileManager';
import { Targetable } from './Targeting';

export class HomingMissile extends Weapon {
  /** 鎖定的最大夾角（弧度）：目標需落在機首前方這個錐形範圍內才會被鎖定 */
  private readonly lockConeAngle = Math.PI / 3; // 60 度

  public fire(ctx: FireContext): void {
    const target = this.selectTarget(ctx);

    ctx.projectiles.spawn({
      kind: ProjectileKind.Missile,
      origin: ctx.origin.clone(),
      direction: ctx.direction.clone(),
      speed: this.spec.projectileSpeed,
      damage: this.spec.damage,
      piercing: false,
      homing: target !== null, // 有鎖到目標才啟用追蹤
      target,
    });

    this.applyCost();
  }

  /**
   * 從所有存活目標中挑選最佳鎖定對象：
   * 位於機首前方錐形範圍內、且與瞄準方向夾角最小者。
   * @returns 選中的目標，若無合適目標則回傳 null
   */
  private selectTarget(ctx: FireContext): Targetable | null {
    const targets = ctx.targets.getTargets();
    let best: Targetable | null = null;
    let bestAngle = this.lockConeAngle;

    const aimDir = ctx.direction.clone().normalize();
    const tmp = new THREE.Vector3();

    for (const t of targets) {
      if (!t.isAlive()) continue;
      // 目標相對於機首的方向
      tmp.copy(t.getPosition()).sub(ctx.origin);
      if (tmp.lengthSq() < 1e-6) continue;
      tmp.normalize();

      const angle = aimDir.angleTo(tmp);
      // 夾角越小代表越接近瞄準方向，優先鎖定
      if (angle < bestAngle) {
        bestAngle = angle;
        best = t;
      }
    }
    return best;
  }
}
