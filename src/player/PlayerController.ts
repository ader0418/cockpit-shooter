/**
 * PlayerController.ts
 * ------------------------------------------------------------
 * 玩家控制器。負責兩件事：
 *   1. 瞄準：讀取滑鼠/鍵盤輸入，讓相機在「基準俯角」上做小幅
 *      擺動（機身微調 pitch/yaw），模擬駕駛戰機微調機首方向。
 *   2. 血量：持有玩家 HP（傷害邏輯在第七階段接上）。
 *
 * 瞄準方向會平滑過渡（lerp），避免相機瞬間跳動，手感更順。
 * 相機正前方＝準心方向＝子彈方向（見 Reticle 說明）。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { GameConfig } from '../config/GameConfig';
import { clamp } from '../utils/MathUtils';

export class PlayerController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: InputManager;

  /** 目前的 yaw/pitch 擺動角度（弧度），會平滑趨近目標值 */
  private currentYaw = 0;
  private currentPitch = -GameConfig.camera.basePitch; // 起始即為基準俯角，避免開場鏡頭滑動

  /** 平滑反應速度：數值越大，相機跟隨瞄準越快、越靈敏 */
  private readonly responsiveness = 8;

  // --- 血量（傷害系統於第七階段接上）---
  private hp: number;
  private readonly maxHp: number;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;

    this.maxHp = GameConfig.player.maxHp;
    this.hp = this.maxHp;

    // 使用 YXZ 旋轉順序：先繞 Y（yaw 左右）再繞 X（pitch 上下），
    // 這是第一人稱相機最直覺的旋轉順序，不會有滾轉扭曲。
    this.camera.rotation.order = 'YXZ';
  }

  /**
   * 每幀更新瞄準。
   * @param delta 距離上一影格的秒數
   */
  public update(delta: number): void {
    // 1) 蒐集瞄準輸入：滑鼠位置 + 鍵盤方向，合併後限制在 [-1, 1]
    const aim = this.gatherAimInput();

    // 2) 依輸入計算目標角度
    //    - yaw：滑鼠右（aim.x 為正）→ 機首向右 → 相機 rotation.y 為負
    //    - pitch：以基準俯角為中心，滑鼠上（aim.y 為正）→ 機首向上
    const cam = GameConfig.camera;
    const targetYaw = -aim.x * cam.maxYaw;
    const targetPitch = -cam.basePitch + aim.y * cam.maxPitch;

    // 3) 平滑趨近目標（指數平滑，與幀率無關）
    const t = Math.min(1, delta * this.responsiveness);
    this.currentYaw += (targetYaw - this.currentYaw) * t;
    this.currentPitch += (targetPitch - this.currentPitch) * t;

    // 4) 套用到相機
    this.camera.rotation.y = this.currentYaw;
    this.camera.rotation.x = this.currentPitch;
  }

  /**
   * 合併滑鼠與鍵盤的瞄準輸入，回傳 [-1,1] 範圍的向量。
   * 滑鼠提供類比式細膩瞄準，方向鍵/WASD 提供數位式輔助。
   */
  private gatherAimInput(): { x: number; y: number } {
    let x = this.input.pointer.x;
    let y = this.input.pointer.y;

    // 鍵盤疊加（右/左、上/下）
    if (this.input.isKeyDown('ArrowRight') || this.input.isKeyDown('KeyD')) x += 1;
    if (this.input.isKeyDown('ArrowLeft') || this.input.isKeyDown('KeyA')) x -= 1;
    if (this.input.isKeyDown('ArrowUp') || this.input.isKeyDown('KeyW')) y += 1;
    if (this.input.isKeyDown('ArrowDown') || this.input.isKeyDown('KeyS')) y -= 1;

    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  // ============================================================
  //  血量相關（供第七階段傷害系統使用）
  // ============================================================

  /** 受到傷害 */
  public takeDamage(amount: number): void {
    this.hp = clamp(this.hp - amount, 0, this.maxHp);
  }

  /** 是否死亡 */
  public isDead(): boolean {
    return this.hp <= 0;
  }

  /** 目前血量 */
  public getHp(): number {
    return this.hp;
  }

  /** 最大血量 */
  public getMaxHp(): number {
    return this.maxHp;
  }

  /** 重置玩家狀態（重新開始遊戲時用） */
  public reset(): void {
    this.hp = this.maxHp;
    this.currentYaw = 0;
    this.currentPitch = -GameConfig.camera.basePitch;
  }
}
