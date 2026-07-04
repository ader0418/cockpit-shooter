/**
 * EnemySpawner.ts
 * ------------------------------------------------------------
 * 敵人生成器。負責：
 *   - 依生成間隔，隨機（加權）生成三種敵人。
 *   - 每幀更新所有敵人的移動，並回收「被擊毀」或「逃脫」的敵人。
 *   - 實作 TargetProvider，提供場上敵人清單給追蹤飛彈鎖定。
 *
 * 難度縮放（生成間隔、血量/速度倍率、是否出現菁英）透過 applyDifficulty()
 * 由外部（第八階段的 DifficultyManager）設定，本類別只負責「照設定生成」。
 *
 * 使用物件池：敵人被擊毀/逃脫後不刪除，而是回收重用，維持穩定效能。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { Enemy } from './Enemy';
import { AircraftEnemy } from './AircraftEnemy';
import { TankEnemy } from './TankEnemy';
import { EliteEnemy } from './EliteEnemy';
import { EnemyConfig, EnemyType, DifficultyCurve } from '../config/EnemyConfig';
import { GameConfig } from '../config/GameConfig';
import { ObjectPool } from '../utils/ObjectPool';
import { TargetProvider, Targetable } from '../weapons/Targeting';
import { randRange } from '../utils/MathUtils';

/** 難度參數（由 DifficultyManager 傳入） */
export interface DifficultyParams {
  spawnInterval: number; // 生成間隔（秒）
  hpMul: number; // 血量倍率
  speedMul: number; // 速度倍率
  allowElite: boolean; // 是否可生成菁英
}

export class EnemySpawner implements TargetProvider {
  private readonly scene: THREE.Scene;

  /** 依類型分開的物件池 */
  private readonly pools: Record<EnemyType, ObjectPool<Enemy>>;
  /** 目前在場上的敵人 */
  private active: Enemy[] = [];

  /** 生成計時器 */
  private spawnTimer = 0;

  /** 目前難度參數（預設：第一關基準值，菁英開放以便測試各敵種） */
  private difficulty: DifficultyParams = {
    spawnInterval: DifficultyCurve.baseSpawnInterval,
    hpMul: 1,
    speedMul: 1,
    allowElite: true,
  };

  /** 敵人被擊毀時的回呼（第七階段接上計分與爆炸） */
  public onEnemyDestroyed?: (enemy: Enemy) => void;
  /** 敵人逃脫（飛到玩家後方）時的回呼（第七階段接上扣血） */
  public onEnemyEscaped?: (enemy: Enemy) => void;

  /** 生成位置暫存向量，避免每次配置記憶體 */
  private readonly tmpPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 三種敵人的物件池，各自用對應子類的工廠建立
    this.pools = {
      [EnemyType.Aircraft]: new ObjectPool(
        () => this.createEnemy(EnemyType.Aircraft),
        10
      ),
      [EnemyType.Tank]: new ObjectPool(() => this.createEnemy(EnemyType.Tank), 6),
      [EnemyType.Elite]: new ObjectPool(() => this.createEnemy(EnemyType.Elite), 3),
    };
  }

  /** 依類型建立一個敵人並加入場景。 */
  private createEnemy(type: EnemyType): Enemy {
    const spec = EnemyConfig[type];
    let enemy: Enemy;
    switch (type) {
      case EnemyType.Aircraft:
        enemy = new AircraftEnemy(spec);
        break;
      case EnemyType.Tank:
        enemy = new TankEnemy(spec);
        break;
      case EnemyType.Elite:
        enemy = new EliteEnemy(spec);
        break;
    }
    this.scene.add(enemy.mesh);
    return enemy;
  }

  /** 由 DifficultyManager 設定當前難度。 */
  public applyDifficulty(params: DifficultyParams): void {
    this.difficulty = params;
  }

  /**
   * 每幀更新：處理生成、移動與回收。
   * @param delta     距離上一影格的秒數
   * @param playerPos 玩家（相機）位置
   */
  public update(delta: number, playerPos: THREE.Vector3): void {
    // --- 1) 生成計時 ---
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.difficulty.spawnInterval) {
      this.spawnTimer -= this.difficulty.spawnInterval;
      this.spawnOne();
    }

    // --- 2) 更新與回收（反向走訪以便安全移除）---
    for (let i = this.active.length - 1; i >= 0; i--) {
      const enemy = this.active[i];
      enemy.update(delta, playerPos);

      if (!enemy.isAlive()) {
        // 血量歸零 → 被擊毀
        this.onEnemyDestroyed?.(enemy);
        this.recycle(i);
      } else if (enemy.mesh.position.z > GameConfig.spawn.despawnZ) {
        // 飛到玩家後方 → 逃脫
        this.onEnemyEscaped?.(enemy);
        this.recycle(i);
      }
    }
  }

  /** 生成一個隨機（加權）敵人。 */
  private spawnOne(): void {
    const type = this.pickType();
    const enemy = this.pools[type].acquire();

    // 決定生成位置
    const cfg = GameConfig.spawn;
    const x = randRange(-cfg.xSpread, cfg.xSpread);
    // 空中敵人給隨機高度；坦克會在自己的 spawn() 內強制貼地
    const y =
      type === EnemyType.Tank
        ? GameConfig.ground.y
        : randRange(cfg.airMinY, cfg.airMaxY);
    this.tmpPos.set(x, y, cfg.spawnZ);

    enemy.spawn(this.tmpPos, this.difficulty.hpMul, this.difficulty.speedMul);
    this.active.push(enemy);
  }

  /** 依 spawnWeight 加權隨機選擇一個敵種（菁英視難度是否開放）。 */
  private pickType(): EnemyType {
    const types: EnemyType[] = [EnemyType.Aircraft, EnemyType.Tank];
    if (this.difficulty.allowElite) types.push(EnemyType.Elite);

    // 加權隨機
    let total = 0;
    for (const t of types) total += EnemyConfig[t].spawnWeight;
    let r = Math.random() * total;
    for (const t of types) {
      r -= EnemyConfig[t].spawnWeight;
      if (r <= 0) return t;
    }
    return EnemyType.Aircraft; // 理論上不會到這，保底
  }

  /** 回收第 index 個敵人：隱藏、歸還物件池。 */
  private recycle(index: number): void {
    const enemy = this.active[index];
    enemy.deactivate();
    this.pools[enemy.type].release(enemy);
    // O(1) 移除：用最後一個補位
    this.active[index] = this.active[this.active.length - 1];
    this.active.pop();
  }

  // --- TargetProvider 介面實作 ---

  /** 回傳場上所有敵人（皆實作 Targetable），供追蹤飛彈鎖定。 */
  public getTargets(): Targetable[] {
    return this.active;
  }

  /** 回傳場上所有敵人（Enemy 型別），供碰撞系統做傷害判定。 */
  public getActiveEnemies(): readonly Enemy[] {
    return this.active;
  }

  /** 目前場上敵人數量（除錯用） */
  public getActiveCount(): number {
    return this.active.length;
  }

  /** 清空所有敵人並重置計時（重新開始遊戲時用）。 */
  public reset(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.recycle(i);
    }
    this.spawnTimer = 0;
  }
}
