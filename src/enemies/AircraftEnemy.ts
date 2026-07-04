/**
 * AircraftEnemy.ts
 * ------------------------------------------------------------
 * 空中敵機：在空中朝玩家直線接近，並帶有輕微的左右蛇行擺動，
 * 血量與體型中等，是最常見的敵人。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { Enemy } from './Enemy';

export class AircraftEnemy extends Enemy {
  /** 蛇行擺動的頻率與幅度 */
  private readonly weaveFrequency = 1.5;
  private readonly weaveAmplitude = 30;
  /** 記錄生成時的基準 X，蛇行以它為中心 */
  private baseX = 0;

  /** 建立外觀：機身（錐體）＋ 主翼（扁平方塊），機首朝 +Z（面向玩家）。 */
  protected createMesh(): THREE.Object3D {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd0483f,
      metalness: 0.3,
      roughness: 0.5,
    });

    // 機身：圓錐，預設沿 +Y，旋轉成沿 +Z（機首指向玩家）
    const body = new THREE.Mesh(new THREE.ConeGeometry(4, 16, 8), bodyMat);
    body.rotation.x = Math.PI / 2; // Y 軸轉到 Z 軸
    group.add(body);

    // 主翼：扁平的橫向方塊
    const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 5), bodyMat);
    group.add(wing);

    this.radius = 11; // 碰撞半徑（近似機身＋翼展）
    return group;
  }

  public spawn(position: THREE.Vector3, hpMul = 1, speedMul = 1): void {
    super.spawn(position, hpMul, speedMul);
    this.baseX = position.x; // 蛇行中心
  }

  /** 移動：朝 +Z 前進，X 以正弦波蛇行。 */
  protected move(delta: number, _playerPos: THREE.Vector3): void {
    this.mesh.position.z += this.speed * delta;
    this.mesh.position.x =
      this.baseX + Math.sin(this.elapsed * this.weaveFrequency) * this.weaveAmplitude;
  }
}
