/**
 * Targeting.ts
 * ------------------------------------------------------------
 * 定義「可被鎖定的目標」與「目標提供者」兩個介面。
 *
 * 這是武器系統（追蹤飛彈）與敵人系統之間的「契約」：
 *   - 追蹤飛彈只依賴 Targetable 介面，不需要知道敵人的實作細節。
 *   - 第六階段的敵人會實作 Targetable，EnemySpawner 會實作 TargetProvider。
 * 用介面解耦，武器系統與敵人系統就能各自獨立開發與測試。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';

/** 可被鎖定的目標（例如敵機） */
export interface Targetable {
  /** 目標目前的世界座標 */
  getPosition(): THREE.Vector3;
  /** 目標是否仍存活（已被擊毀就不該再被鎖定） */
  isAlive(): boolean;
}

/** 目標提供者：能回傳目前場上所有可鎖定的目標 */
export interface TargetProvider {
  getTargets(): Targetable[];
}
