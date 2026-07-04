/**
 * ProjectileManager.ts
 * ------------------------------------------------------------
 * 管理所有「彈藥」（子彈 / 飛彈 / 雷射）的生命週期：
 *   - 生成 (spawn)：由武器呼叫，從物件池取出並設定好狀態後射出。
 *   - 更新 (update)：每幀移動彈藥、處理追蹤轉向、超距離就回收。
 *   - 回收：彈藥飛太遠或命中（第七階段）後，藏起來歸還物件池重用。
 *
 * 依視覺分成三種池（子彈 / 飛彈 / 雷射），各自有不同幾何外觀，
 * 但共用同一套飛行與回收邏輯。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool';
import { Targetable } from './Targeting';

/** 彈藥視覺種類 */
export enum ProjectileKind {
  Bullet = 'bullet', // 機關槍子彈（小光點）
  Missile = 'missile', // 追蹤飛彈（細長彈體）
  Laser = 'laser', // 雷射（長光束）
}

/** 生成彈藥所需的參數 */
export interface SpawnOptions {
  kind: ProjectileKind;
  origin: THREE.Vector3; // 起始位置
  direction: THREE.Vector3; // 初始方向（單位向量）
  speed: number; // 飛行速度
  damage: number; // 傷害
  piercing: boolean; // 是否穿透（雷射）
  homing: boolean; // 是否追蹤
  target: Targetable | null; // 追蹤目標（homing 為 true 時使用）
}

/**
 * 單發彈藥。持有一個 mesh 與飛行狀態。
 * 由 ObjectPool 重複使用，因此所有欄位都能被 reset。
 */
export class Projectile {
  public readonly mesh: THREE.Mesh;
  public kind: ProjectileKind = ProjectileKind.Bullet;
  public readonly velocity = new THREE.Vector3();
  /** 前一幀的位置（掃掠碰撞用：把移動視為線段以免高速穿透） */
  public readonly prevPosition = new THREE.Vector3();
  /** 碰撞半徑 */
  public radius = 1.5;
  public speed = 0;
  public damage = 0;
  public piercing = false;
  public homing = false;
  public target: Targetable | null = null;
  public alive = false;
  public distanceTraveled = 0;
  /** 穿透彈已命中過的目標（避免同一發重複扣血），第七階段使用 */
  public readonly hitSet = new Set<Targetable>();

  constructor(mesh: THREE.Mesh) {
    this.mesh = mesh;
  }
}

export class ProjectileManager {
  private readonly scene: THREE.Scene;

  /** 依種類分開的物件池 */
  private readonly pools: Record<ProjectileKind, ObjectPool<Projectile>>;

  /** 目前在場上飛行的彈藥 */
  private active: Projectile[] = [];

  /** 彈藥飛超過此距離就回收（避免無限存在） */
  private readonly maxDistance = 2200;
  /** 追蹤飛彈每秒最大轉向弧度（越大轉得越急） */
  private readonly homingTurnRate = 2.6;

  /** 共用材質（依種類），避免每發都建立新材質 */
  private readonly materials: Record<ProjectileKind, THREE.MeshBasicMaterial>;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 三種彈藥的共用發光材質（MeshBasicMaterial 不受光影響，永遠明亮）
    this.materials = {
      [ProjectileKind.Bullet]: new THREE.MeshBasicMaterial({ color: 0xfff27a }),
      [ProjectileKind.Missile]: new THREE.MeshBasicMaterial({ color: 0xff8a4a }),
      [ProjectileKind.Laser]: new THREE.MeshBasicMaterial({ color: 0x7af7ff }),
    };

    // 三種彈藥的物件池，各自用對應的工廠函式建立 mesh
    this.pools = {
      [ProjectileKind.Bullet]: new ObjectPool(
        () => this.createProjectile(ProjectileKind.Bullet),
        30 // 預熱 30 發子彈
      ),
      [ProjectileKind.Missile]: new ObjectPool(
        () => this.createProjectile(ProjectileKind.Missile),
        8
      ),
      [ProjectileKind.Laser]: new ObjectPool(
        () => this.createProjectile(ProjectileKind.Laser),
        6
      ),
    };
  }

  /** 依種類建立一個彈藥（含幾何外觀）。 */
  private createProjectile(kind: ProjectileKind): Projectile {
    let geometry: THREE.BufferGeometry;
    switch (kind) {
      case ProjectileKind.Bullet:
        // 小光球，稍微拉長成曳光彈
        geometry = new THREE.SphereGeometry(0.9, 8, 8);
        break;
      case ProjectileKind.Missile:
        // 細長彈體（圓柱，預設沿 Y 軸，之後旋轉對齊飛行方向）
        geometry = new THREE.CylinderGeometry(0.6, 0.6, 5, 8);
        break;
      case ProjectileKind.Laser:
        // 長光束
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 40, 8);
        break;
    }
    const mesh = new THREE.Mesh(geometry, this.materials[kind]);
    mesh.visible = false;
    this.scene.add(mesh);
    return new Projectile(mesh);
  }

  /**
   * 生成一發彈藥並射出。
   * @param opts 生成參數
   */
  public spawn(opts: SpawnOptions): void {
    const p = this.pools[opts.kind].acquire();

    p.kind = opts.kind;
    p.speed = opts.speed;
    p.damage = opts.damage;
    p.piercing = opts.piercing;
    p.homing = opts.homing;
    p.target = opts.target;
    p.alive = true;
    p.distanceTraveled = 0;
    p.hitSet.clear();

    // 初始速度＝方向 × 速率
    p.velocity.copy(opts.direction).normalize().multiplyScalar(opts.speed);

    // 放到起始位置、朝向飛行方向、顯示出來
    p.mesh.position.copy(opts.origin);
    p.prevPosition.copy(opts.origin);
    // 依種類設定碰撞半徑（雷射較粗、飛彈次之、子彈最細）
    p.radius = opts.kind === ProjectileKind.Laser ? 3 : opts.kind === ProjectileKind.Missile ? 2.5 : 1.5;
    this.orientToVelocity(p);
    p.mesh.visible = true;

    this.active.push(p);
  }

  /**
   * 讓細長型彈藥（飛彈 / 雷射）的 mesh 對齊飛行方向。
   * 圓柱預設沿 Y 軸，因此用四元數把 Y 軸轉到速度方向。
   */
  private orientToVelocity(p: Projectile): void {
    if (p.kind === ProjectileKind.Bullet) return; // 球體不需對齊
    const dir = p.velocity.clone().normalize();
    p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  /**
   * 每幀更新所有存活彈藥。
   * @param delta 距離上一影格的秒數
   */
  public update(delta: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];

      // 追蹤飛彈：若目標仍存活，逐步把速度方向轉向目標
      if (p.homing && p.target && p.target.isAlive()) {
        this.steerHoming(p, delta);
      }

      // 依速度移動（先記錄前一幀位置，供碰撞系統做掃掠檢查）
      p.prevPosition.copy(p.mesh.position);
      const step = p.velocity.clone().multiplyScalar(delta);
      p.mesh.position.add(step);
      p.distanceTraveled += step.length();

      // 超過最大距離就回收
      if (p.distanceTraveled >= this.maxDistance || !p.alive) {
        this.recycle(i);
      }
    }
  }

  /** 追蹤轉向：把速度方向以最大轉向率朝目標旋轉。 */
  private steerHoming(p: Projectile, delta: number): void {
    const desired = p.target!.getPosition().clone().sub(p.mesh.position).normalize();
    const current = p.velocity.clone().normalize();

    // 用球面插值限制每幀轉向幅度，做出「彈道弧線追蹤」而非瞬間轉向
    const maxStep = this.homingTurnRate * delta;
    const angle = current.angleTo(desired);
    const t = angle > 0 ? Math.min(1, maxStep / angle) : 1;

    const newDir = current.lerp(desired, t).normalize();
    p.velocity.copy(newDir.multiplyScalar(p.speed));
    this.orientToVelocity(p);
  }

  /** 回收第 index 個存活彈藥：藏起來、歸還對應物件池。 */
  private recycle(index: number): void {
    const p = this.active[index];
    p.alive = false;
    p.mesh.visible = false;
    p.target = null;
    this.pools[p.kind].release(p);
    // 從 active 陣列移除（用最後一個補位，O(1) 移除）
    this.active[index] = this.active[this.active.length - 1];
    this.active.pop();
  }

  /** 取得目前所有存活彈藥（供第七階段碰撞系統查詢） */
  public getActive(): readonly Projectile[] {
    return this.active;
  }

  /** 標記一發彈藥該被回收（碰撞命中後由碰撞系統呼叫，第七階段用） */
  public kill(p: Projectile): void {
    p.alive = false;
  }

  /** 清空所有彈藥（重新開始遊戲時用） */
  public clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.recycle(i);
    }
  }

  /** 釋放資源 */
  public dispose(): void {
    this.clear();
    for (const kind of Object.values(ProjectileKind)) {
      this.materials[kind].dispose();
    }
  }
}
