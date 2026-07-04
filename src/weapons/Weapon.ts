/**
 * Weapon.ts
 * ------------------------------------------------------------
 * 武器抽象基底類別。定義所有武器共通的邏輯：
 *   - 冷卻時間（fireInterval）管理：控制射速。
 *   - 彈藥（ammo）管理：-1 代表無限。
 *   - canFire()：是否可以開火（冷卻結束且有彈藥）。
 *
 * 各種武器只需繼承本類別並實作 fire()，寫出自己「射出什麼、怎麼射」，
 * 不必重複處理冷卻與彈藥。這就是多型：WeaponController 只呼叫
 * weapon.fire()，實際行為由各子類決定，日後加新武器不用改控制器。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { WeaponSpec } from '../config/WeaponConfig';
import { ProjectileManager } from './ProjectileManager';
import { TargetProvider } from './Targeting';

/** 開火時提供給武器的情境資訊 */
export interface FireContext {
  origin: THREE.Vector3; // 射擊起點（機首位置）
  direction: THREE.Vector3; // 射擊方向（相機正前方，單位向量）
  projectiles: ProjectileManager; // 用來生成彈藥
  targets: TargetProvider; // 可鎖定的目標（追蹤飛彈用）
}

export abstract class Weapon {
  /** 此武器的數值設定 */
  protected readonly spec: WeaponSpec;
  /** 距離下次可開火的剩餘冷卻時間（秒） */
  protected cooldown = 0;
  /** 目前彈藥量（-1 代表無限） */
  protected ammo: number;

  constructor(spec: WeaponSpec) {
    this.spec = spec;
    this.ammo = spec.maxAmmo;
  }

  /** 每幀更新冷卻計時 */
  public update(delta: number): void {
    if (this.cooldown > 0) this.cooldown -= delta;
  }

  /** 是否可以開火：冷卻已結束，且彈藥未耗盡 */
  public canFire(): boolean {
    const hasAmmo = this.ammo === -1 || this.ammo > 0;
    return this.cooldown <= 0 && hasAmmo;
  }

  /**
   * 開火。由 WeaponController 在 canFire() 為真時呼叫。
   * 子類別實作實際的彈藥生成邏輯。
   */
  public abstract fire(ctx: FireContext): void;

  /** 子類別開火後呼叫：重設冷卻並扣除彈藥。 */
  protected applyCost(): void {
    this.cooldown = this.spec.fireInterval;
    if (this.ammo > 0) this.ammo--;
  }

  // --- 供 HUD / 控制器查詢的資訊 ---

  public getSpec(): WeaponSpec {
    return this.spec;
  }

  /** 目前彈藥（-1 代表無限） */
  public getAmmo(): number {
    return this.ammo;
  }

  /** 補滿彈藥（過關獎勵或重新開始時用） */
  public refill(): void {
    this.ammo = this.spec.maxAmmo;
  }

  /** 重置武器狀態 */
  public reset(): void {
    this.cooldown = 0;
    this.ammo = this.spec.maxAmmo;
  }
}
