/**
 * EffectsManager.ts
 * ------------------------------------------------------------
 * 視覺特效管理器。目前負責「爆炸」：以擴張並淡出的發光光球
 * 呈現敵人被擊毀的回饋。使用物件池重用光球，避免頻繁配置。
 *
 * 這是架構的一個補充模組（原規劃未列出），因為擊毀回饋屬於
 * 純視覺、與碰撞/計分邏輯獨立，分開管理較清楚。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool';

/** 單一爆炸光球的狀態 */
class Explosion {
  public readonly sprite: THREE.Sprite;
  public age = 0; // 已存在時間
  public duration = 0; // 總持續時間
  public startScale = 0; // 起始尺寸
  public endScale = 0; // 結束尺寸
  public alive = false;

  constructor(sprite: THREE.Sprite) {
    this.sprite = sprite;
  }
}

export class EffectsManager {
  private readonly scene: THREE.Scene;
  private readonly pool: ObjectPool<Explosion>;
  private active: Explosion[] = [];
  private readonly texture: THREE.Texture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.texture = this.createGlowTexture();
    this.pool = new ObjectPool(() => this.createExplosion(), 12);
  }

  /** 建立一個爆炸光球（sprite）。 */
  private createExplosion(): Explosion {
    const material = new THREE.SpriteMaterial({
      map: this.texture,
      color: 0xffa53a,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // 疊加混合讓爆炸更亮眼
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    this.scene.add(sprite);
    return new Explosion(sprite);
  }

  /** 產生放射狀發光貼圖。 */
  private createGlowTexture(): THREE.Texture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,220,150,0.9)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  /**
   * 在指定位置產生一次爆炸。
   * @param position 爆炸中心
   * @param size     爆炸最大尺寸（依敵人大小調整）
   * @param color    顏色
   */
  public spawn(position: THREE.Vector3, size = 40, color = 0xffa53a): void {
    const e = this.pool.acquire();
    e.age = 0;
    e.duration = 0.45;
    e.startScale = size * 0.4;
    e.endScale = size * 1.6;
    e.alive = true;
    e.sprite.position.copy(position);
    (e.sprite.material as THREE.SpriteMaterial).color.setHex(color);
    e.sprite.scale.setScalar(e.startScale);
    e.sprite.material.opacity = 1;
    e.sprite.visible = true;
    this.active.push(e);
  }

  /** 每幀更新：擴張並淡出，結束後回收。 */
  public update(delta: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.age += delta;
      const t = Math.min(1, e.age / e.duration);
      // 尺寸線性擴張、透明度隨時間淡出
      const scale = e.startScale + (e.endScale - e.startScale) * t;
      e.sprite.scale.setScalar(scale);
      e.sprite.material.opacity = 1 - t;

      if (t >= 1) {
        e.alive = false;
        e.sprite.visible = false;
        this.pool.release(e);
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
      }
    }
  }

  /** 清空所有特效（重新開始時用）。 */
  public clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.sprite.visible = false;
      this.pool.release(e);
      this.active.pop();
    }
  }

  /** 釋放資源 */
  public dispose(): void {
    this.clear();
    this.texture.dispose();
  }
}
