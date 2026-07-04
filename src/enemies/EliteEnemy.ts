/**
 * EliteEnemy.ts
 * ------------------------------------------------------------
 * 菁英單位：血量高、速度快，移動模式更複雜——除了朝玩家前進，
 * 還會主動修正 X 位置朝玩家逼近，並疊加較大幅度的閃避擺動，
 * 比一般敵機更難命中、更具威脅。外觀為發光的稜形核心加環。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { Enemy } from './Enemy';
import { lerp } from '../utils/MathUtils';

export class EliteEnemy extends Enemy {
  /** 閃避擺動的頻率與幅度（比一般敵機大） */
  private readonly weaveFrequency = 2.4;
  private readonly weaveAmplitude = 55;
  /** 朝玩家 X 位置逼近的強度（每秒插值比例） */
  private readonly homingStrength = 0.6;

  private core!: THREE.Mesh;

  /** 建立外觀：發光稜形核心 + 外環。 */
  protected createMesh(): THREE.Object3D {
    const group = new THREE.Group();

    // 核心：八面體，發光紫紅色
    this.core = new THREE.Mesh(
      new THREE.OctahedronGeometry(9),
      new THREE.MeshStandardMaterial({
        color: 0xb838d6,
        emissive: 0x6a1080,
        emissiveIntensity: 0.6,
        metalness: 0.4,
        roughness: 0.3,
      })
    );
    group.add(this.core);

    // 外環：環面（torus）
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(14, 1.2, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xe58bff, metalness: 0.5, roughness: 0.4 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    this.radius = 16; // 碰撞半徑（含外環）
    return group;
  }

  /**
   * 移動：朝 +Z 前進；X 方向一邊朝玩家逼近、一邊大幅擺動閃避；
   * 核心持續自轉增加視覺威脅感。
   */
  protected move(delta: number, playerPos: THREE.Vector3): void {
    this.mesh.position.z += this.speed * delta;

    // 朝玩家 X 位置緩慢逼近（插值），再疊加擺動
    const t = Math.min(1, this.homingStrength * delta);
    const towardX = lerp(this.mesh.position.x, playerPos.x, t);
    this.mesh.position.x =
      towardX + Math.sin(this.elapsed * this.weaveFrequency) * this.weaveAmplitude * delta * 6;

    // 核心自轉
    this.core.rotation.y += delta * 3;
    this.core.rotation.x += delta * 1.5;
  }
}
