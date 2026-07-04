/**
 * EnvironmentManager.ts
 * ------------------------------------------------------------
 * 管理「世界環境」的所有視覺層次，由遠到近分為四層：
 *   1. 天空 (Sky)      —— 漸層天空球，無限遠、固定不動。
 *   2. 城市 (City)     —— 地面上的建築剪影，向後流動、循環回收。
 *   3. 雲層 (Clouds)   —— 飄動的雲朵 sprite，向後流動、循環回收。
 *   4. 地面 (Ground)   —— 網格地面，透過捲動貼圖製造前進感。
 *
 * 視差原理：城市、雲層、地面全部以 world.flightSpeed 這個統一速度
 * 「向相機方向（+Z）移動」。因為它們距離相機遠近不同，透視投影會
 * 讓近的物件在畫面上移動得快、遠的移動得慢——這就是視差效果，
 * 不需要為每一層各自設定速度。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';
import { randRange, randSign } from '../utils/MathUtils';

export class EnvironmentManager {
  private readonly scene: THREE.Scene;

  // --- 地面 ---
  private ground!: THREE.Mesh;
  private groundTexture!: THREE.Texture;

  // --- 天空 ---
  private sky!: THREE.Mesh;

  // --- 雲層（sprite 陣列，循環使用） ---
  private clouds: THREE.Sprite[] = [];

  // --- 城市（建築 mesh 陣列，循環使用） ---
  private buildings: THREE.Mesh[] = [];
  /** 城市建築共用的單位方塊幾何體（用 scale 調整各自大小，省記憶體） */
  private buildingGeometry!: THREE.BoxGeometry;
  private buildingMaterial!: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // 建立順序不影響結果，但由遠到近建立便於理解
    this.createSky();
    this.createCity();
    this.createClouds();
    this.createGround();
  }

  // ============================================================
  //  天空層
  // ============================================================

  /**
   * 建立漸層天空：一顆超大球，材質用自訂 shader 由天頂色漸層到地平線色。
   * 使用 BackSide 讓我們從球體內部看到顏色；關閉 fog 讓天空保持乾淨漸層。
   */
  private createSky(): void {
    const cfg = GameConfig.sky;
    const geometry = new THREE.SphereGeometry(cfg.radius, 32, 16);

    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide, // 從內側觀看
      depthWrite: false, // 天空不寫入深度，永遠當背景
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(cfg.topColor) },
        horizonColor: { value: new THREE.Color(cfg.horizonColor) },
      },
      // 依照世界座標的 Y 高度做上下漸層
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPosition;
        void main() {
          // 依高度方向做混合：越高越接近天頂色，接近地平線則用地平線色
          float h = normalize(vWorldPosition).y;
          float t = clamp(pow(max(h, 0.0), 0.6), 0.0, 1.0);
          gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
        }
      `,
    });

    this.sky = new THREE.Mesh(geometry, material);
    this.scene.add(this.sky);
  }

  // ============================================================
  //  城市層
  // ============================================================

  /**
   * 建立城市：一堆站在地面上的方塊當作建築剪影。
   * 建築分布在航道兩側（中央留淨空），向後流動並循環回收，
   * 呈現「飛越城市上空」的效果。
   */
  private createCity(): void {
    const cfg = GameConfig.city;

    // 共用幾何體與材質：所有建築共用一份，透過 scale 變化大小
    this.buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.buildingMaterial = new THREE.MeshBasicMaterial({ color: cfg.color });

    for (let i = 0; i < cfg.count; i++) {
      const mesh = new THREE.Mesh(this.buildingGeometry, this.buildingMaterial);
      // 沿深度均勻分散初始位置，避免一次全部同時出現
      const z = randRange(cfg.spawnZ, cfg.recycleZ);
      this.placeBuilding(mesh, z);
      this.scene.add(mesh);
      this.buildings.push(mesh);
    }
  }

  /**
   * 把一棟建築放到指定深度，並隨機給定尺寸與左右位置。
   * @param mesh 建築 mesh
   * @param z    深度位置
   */
  private placeBuilding(mesh: THREE.Mesh, z: number): void {
    const cfg = GameConfig.city;
    const w = randRange(cfg.minWidth, cfg.maxWidth);
    const d = randRange(cfg.minWidth, cfg.maxWidth);
    const h = randRange(cfg.minHeight, cfg.maxHeight);

    // 左右分布：在 [centerClear, spread] 範圍內取值，再隨機決定左或右，
    // 讓正前方航道保持淨空。
    const x = randSign() * randRange(cfg.centerClear, cfg.spread);

    mesh.scale.set(w, h, d);
    // 建築底部貼齊地面（box 中心在原點，故 y 要抬高一半高度）
    mesh.position.set(x, h / 2 + GameConfig.ground.y, z);
  }

  // ============================================================
  //  雲層
  // ============================================================

  /** 建立雲層：一批半透明 sprite，飄浮在空中並向後流動。 */
  private createClouds(): void {
    const cfg = GameConfig.clouds;
    const texture = this.createCloudTexture();

    for (let i = 0; i < cfg.count; i++) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        depthWrite: false, // 半透明物件不寫深度，避免互相遮擋出錯
      });
      const sprite = new THREE.Sprite(material);
      const z = randRange(cfg.spawnZ, cfg.recycleZ);
      this.placeCloud(sprite, z);
      this.scene.add(sprite);
      this.clouds.push(sprite);
    }
  }

  /** 把一朵雲放到指定深度，隨機給定高度、左右位置與大小。 */
  private placeCloud(sprite: THREE.Sprite, z: number): void {
    const cfg = GameConfig.clouds;
    const x = randRange(-cfg.spread, cfg.spread);
    const y = randRange(cfg.minY, cfg.maxY);
    const scale = randRange(cfg.minScale, cfg.maxScale);
    sprite.position.set(x, y, z);
    // 雲扁一點比較自然（寬 > 高）
    sprite.scale.set(scale, scale * 0.55, 1);
  }

  /** 用 Canvas 程式生成一張柔邊圓形雲朵貼圖（放射狀漸層 + 透明邊緣）。 */
  private createCloudTexture(): THREE.Texture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(canvas);
  }

  // ============================================================
  //  地面層
  // ============================================================

  /** 建立地面：一片鋪在世界下方的大平面，貼上程式生成的網格貼圖。 */
  private createGround(): void {
    const cfg = GameConfig.ground;

    this.groundTexture = this.createGridTexture();
    this.groundTexture.wrapS = THREE.RepeatWrapping;
    this.groundTexture.wrapT = THREE.RepeatWrapping;
    this.groundTexture.repeat.set(40, 40);

    const geometry = new THREE.PlaneGeometry(cfg.size, cfg.size);
    const material = new THREE.MeshStandardMaterial({
      map: this.groundTexture,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.ground = new THREE.Mesh(geometry, material);
    this.ground.rotation.x = -Math.PI / 2; // 躺平成地面
    this.ground.position.y = cfg.y;
    this.scene.add(this.ground);
  }

  /** 用 Canvas 2D 畫出網格貼圖。 */
  private createGridTexture(): THREE.Texture {
    const cfg = GameConfig.ground;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#' + cfg.baseColor.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#' + cfg.gridColor.toString(16).padStart(6, '0');
    ctx.lineWidth = 2;
    const step = size / cfg.gridDivisions;
    ctx.beginPath();
    for (let i = 0; i <= cfg.gridDivisions; i++) {
      const p = Math.round(i * step) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  // ============================================================
  //  每幀更新
  // ============================================================

  /**
   * 每幀更新所有會動的環境層。
   * @param delta 距離上一影格的秒數
   */
  public update(delta: number): void {
    const speed = GameConfig.world.flightSpeed;
    const move = speed * delta; // 這一影格所有物件要往 +Z 移動的距離

    // --- 地面：捲動貼圖，位移量換算成貼圖 repeat 單位 ---
    const tileWorldSize = GameConfig.ground.size / this.groundTexture.repeat.y;
    this.groundTexture.offset.y -= move / tileWorldSize;

    // --- 城市：整批向 +Z 移動，越過相機後方就回收到遠方重生 ---
    for (const b of this.buildings) {
      b.position.z += move;
      if (b.position.z > GameConfig.city.recycleZ) {
        this.placeBuilding(b, GameConfig.city.spawnZ);
      }
    }

    // --- 雲層：同上邏輯 ---
    for (const c of this.clouds) {
      c.position.z += move;
      if (c.position.z > GameConfig.clouds.recycleZ) {
        this.placeCloud(c, GameConfig.clouds.spawnZ);
      }
    }
  }

  /** 釋放所有資源 */
  public dispose(): void {
    // 地面
    this.scene.remove(this.ground);
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.groundTexture.dispose();

    // 天空
    this.scene.remove(this.sky);
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();

    // 城市
    for (const b of this.buildings) this.scene.remove(b);
    this.buildingGeometry.dispose();
    this.buildingMaterial.dispose();
    this.buildings = [];

    // 雲層
    for (const c of this.clouds) {
      this.scene.remove(c);
      c.material.dispose();
    }
    this.clouds = [];
  }
}
