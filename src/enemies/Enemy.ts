/**
 * Enemy.ts
 * ------------------------------------------------------------
 * 敵人抽象基底類別。統一處理所有敵人共通的邏輯：
 *   - 血量、速度、分數等狀態。
 *   - spawn()：從物件池取出後重新初始化（位置、血量、難度倍率）。
 *   - takeDamage()：受傷與死亡判定。
 *   - 實作 Targetable 介面（getPosition / isAlive），讓追蹤飛彈能鎖定。
 *
 * 各敵種只需繼承本類別，實作 createMesh()（外觀）與 move()（移動模式），
 * 其餘共通行為都由基底處理。這讓新增敵種變得單純（多型）。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { EnemySpec, EnemyType } from '../config/EnemyConfig';
import { Targetable } from '../weapons/Targeting';

export abstract class Enemy implements Targetable {
  /** 敵人的 3D 物件（可能由多個部件組成，故用 Object3D/Group） */
  public readonly mesh: THREE.Object3D;
  /** 此敵種的基準設定 */
  protected readonly spec: EnemySpec;
  /** 敵種類型 */
  public readonly type: EnemyType;

  /** 目前血量與最大血量 */
  protected hp = 0;
  protected maxHp = 0;
  /** 實際移動速度（已套用難度倍率） */
  protected speed = 0;
  /** 是否存活 */
  protected alive = false;
  /** 自生成以來經過的時間（秒），供移動模式使用 */
  protected elapsed = 0;
  /** 碰撞半徑（球體近似），由各子類在 createMesh() 中設定 */
  protected radius = 10;

  constructor(spec: EnemySpec) {
    this.spec = spec;
    this.type = spec.type;
    this.mesh = this.createMesh();
    this.mesh.visible = false;
  }

  /**
   * 生成（或重生）此敵人。由 EnemySpawner 從物件池取出後呼叫。
   * @param position 生成位置
   * @param hpMul    血量倍率（難度縮放，第八階段用；預設 1）
   * @param speedMul 速度倍率（難度縮放，第八階段用；預設 1）
   */
  public spawn(position: THREE.Vector3, hpMul = 1, speedMul = 1): void {
    this.maxHp = this.spec.baseHp * hpMul;
    this.hp = this.maxHp;
    this.speed = this.spec.baseSpeed * speedMul;
    this.elapsed = 0;
    this.alive = true;
    this.mesh.position.copy(position);
    this.mesh.visible = true;
  }

  /**
   * 每幀更新：推進計時並執行子類的移動模式。
   * @param delta     距離上一影格的秒數
   * @param playerPos 玩家（相機）位置，供追向玩家的移動模式使用
   */
  public update(delta: number, playerPos: THREE.Vector3): void {
    if (!this.alive) return;
    this.elapsed += delta;
    this.move(delta, playerPos);
  }

  /** 受到傷害，血量歸零則標記死亡。 */
  public takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  /** 強制標記為非存活（回收前用） */
  public deactivate(): void {
    this.alive = false;
    this.mesh.visible = false;
  }

  /** 可得分數 */
  public getScoreValue(): number {
    return this.spec.scoreValue;
  }

  /** 碰撞半徑 */
  public getRadius(): number {
    return this.radius;
  }

  /** 撞到玩家造成的傷害 */
  public getContactDamage(): number {
    return this.spec.contactDamage;
  }

  // --- Targetable 介面實作 ---

  /** 回傳目前世界座標（回傳實時參考，追蹤飛彈每幀取用） */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  /** 是否仍存活 */
  public isAlive(): boolean {
    return this.alive;
  }

  // --- 由子類別實作 ---

  /** 建立此敵種的 3D 外觀（只在建構時呼叫一次）。 */
  protected abstract createMesh(): THREE.Object3D;

  /**
   * 此敵種的移動模式（每幀呼叫）。
   * 慣例：敵人朝 +Z（玩家方向）前進，各子類可疊加左右擺動等變化。
   */
  protected abstract move(delta: number, playerPos: THREE.Vector3): void;
}
