/**
 * CollisionSystem.ts
 * ------------------------------------------------------------
 * 碰撞系統。每幀處理兩類碰撞：
 *   1. 彈藥 ↔ 敵人：子彈打中敵人 → 敵人扣血；非穿透彈命中後消失，
 *      穿透彈（雷射）可貫穿多個敵人（用 hitSet 避免同一發重複扣血）。
 *      敵人血量歸零 → 觸發「擊毀」回呼（計分 + 爆炸）。
 *   2. 敵人 ↔ 玩家：敵人撞上玩家 → 玩家扣血、敵人銷毀（自爆）。
 *
 * 採球體近似碰撞；彈藥用「掃掠碰撞」（檢查其移動線段），
 * 確保高速彈藥不會在兩幀之間穿過敵人。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { ProjectileManager } from '../weapons/ProjectileManager';
import { EnemySpawner } from '../enemies/EnemySpawner';
import { Enemy } from '../enemies/Enemy';
import { PlayerController } from '../player/PlayerController';
import { distancePointToSegmentSq } from '../utils/MathUtils';

/** 碰撞事件的回呼集合 */
export interface CollisionCallbacks {
  /** 敵人被擊毀（含擊毀者資訊）→ 通常用於計分與爆炸特效 */
  onEnemyDestroyed: (enemy: Enemy) => void;
  /** 敵人撞上玩家 → 通常用於扣血與爆炸特效 */
  onPlayerHit: (enemy: Enemy) => void;
}

export class CollisionSystem {
  private readonly projectiles: ProjectileManager;
  private readonly enemies: EnemySpawner;
  private readonly player: PlayerController;
  private readonly callbacks: CollisionCallbacks;
  /** 玩家（機身）碰撞半徑 */
  private readonly playerRadius = 10;

  constructor(
    projectiles: ProjectileManager,
    enemies: EnemySpawner,
    player: PlayerController,
    callbacks: CollisionCallbacks
  ) {
    this.projectiles = projectiles;
    this.enemies = enemies;
    this.player = player;
    this.callbacks = callbacks;
  }

  /**
   * 每幀執行碰撞判定。
   * @param playerPos 玩家（相機）位置
   */
  public update(playerPos: THREE.Vector3): void {
    this.checkProjectilesVsEnemies();
    this.checkEnemiesVsPlayer(playerPos);
  }

  /** 彈藥 ↔ 敵人 */
  private checkProjectilesVsEnemies(): void {
    const projectiles = this.projectiles.getActive();
    const enemies = this.enemies.getActiveEnemies();

    for (const p of projectiles) {
      if (!p.alive) continue;

      for (const enemy of enemies) {
        if (!enemy.isAlive()) continue;
        // 穿透彈已打過這個敵人就跳過，避免重複扣血
        if (p.piercing && p.hitSet.has(enemy)) continue;

        const ePos = enemy.getPosition();
        const hitDist = enemy.getRadius() + p.radius;

        // 掃掠碰撞：敵人中心到「彈藥移動線段」的距離是否小於命中距離
        const distSq = distancePointToSegmentSq(
          ePos.x, ePos.y, ePos.z,
          p.prevPosition.x, p.prevPosition.y, p.prevPosition.z,
          p.mesh.position.x, p.mesh.position.y, p.mesh.position.z
        );

        if (distSq <= hitDist * hitDist) {
          // 命中：扣血
          const wasAlive = enemy.isAlive();
          enemy.takeDamage(p.damage);

          // 若這一擊使敵人死亡，觸發擊毀回呼（計分 + 爆炸）
          if (wasAlive && !enemy.isAlive()) {
            this.callbacks.onEnemyDestroyed(enemy);
          }

          if (p.piercing) {
            // 穿透彈：記錄已命中，繼續飛行
            p.hitSet.add(enemy);
          } else {
            // 一般彈：命中即消失
            this.projectiles.kill(p);
            break; // 這發子彈已結束，換下一發
          }
        }
      }
    }
  }

  /** 敵人 ↔ 玩家 */
  private checkEnemiesVsPlayer(playerPos: THREE.Vector3): void {
    const enemies = this.enemies.getActiveEnemies();

    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;

      const ePos = enemy.getPosition();
      const hitDist = enemy.getRadius() + this.playerRadius;
      const dx = ePos.x - playerPos.x;
      const dy = ePos.y - playerPos.y;
      const dz = ePos.z - playerPos.z;

      if (dx * dx + dy * dy + dz * dz <= hitDist * hitDist) {
        // 撞上玩家：玩家扣血、敵人自爆
        this.player.takeDamage(enemy.getContactDamage());
        this.callbacks.onPlayerHit(enemy);
        // 讓敵人死亡（下一幀由 EnemySpawner 回收）
        enemy.takeDamage(Number.MAX_SAFE_INTEGER);
      }
    }
  }
}
