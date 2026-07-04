/**
 * TankEnemy.ts
 * ------------------------------------------------------------
 * 地面坦克：在地面上朝玩家直線推進，速度慢但血量較高。
 * 由車體、砲塔、砲管三個部件組成。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { Enemy } from './Enemy';
import { GameConfig } from '../config/GameConfig';

export class TankEnemy extends Enemy {
  /** 建立外觀：車體 + 砲塔 + 砲管，並讓底部貼齊地面。 */
  protected createMesh(): THREE.Object3D {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x556b3a,
      metalness: 0.2,
      roughness: 0.8,
    });

    // 車體
    const hull = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 22), mat);
    hull.position.y = 3;
    group.add(hull);

    // 砲塔
    const turret = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 9), mat);
    turret.position.y = 8;
    group.add(turret);

    // 砲管（指向 +Z，面向玩家）
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 14, 8), mat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 8, 9);
    group.add(barrel);

    this.radius = 13; // 碰撞半徑（近似車體對角）
    return group;
  }

  public spawn(position: THREE.Vector3, hpMul = 1, speedMul = 1): void {
    // 強制貼齊地面高度
    position.y = GameConfig.ground.y;
    super.spawn(position, hpMul, speedMul);
  }

  /** 移動：在地面上朝 +Z 直線推進。 */
  protected move(delta: number, _playerPos: THREE.Vector3): void {
    this.mesh.position.z += this.speed * delta;
  }
}
