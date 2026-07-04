/**
 * SceneManager.ts
 * ------------------------------------------------------------
 * 負責建立與管理 Three.js 的三大核心物件：
 *   1. Scene       —— 場景（所有 3D 物件的容器）
 *   2. Camera      —— 第一人稱駕駛艙相機
 *   3. Renderer    —— WebGL 渲染器（把場景畫到 canvas）
 *
 * 也處理光源、霧效（景深）、視窗縮放。
 * 之後的背景景深層（第三階段）、玩家、敵人都會加進這個 scene。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';

export class SceneManager {
  /** Three.js 場景物件 */
  public readonly scene: THREE.Scene;
  /** 第一人稱相機 */
  public readonly camera: THREE.PerspectiveCamera;
  /** WebGL 渲染器 */
  public readonly renderer: THREE.WebGLRenderer;

  /** canvas 掛載的容器 DOM */
  private readonly container: HTMLElement;

  /**
   * @param container 用來放置 canvas 的 HTML 容器元素
   */
  constructor(container: HTMLElement) {
    this.container = container;

    // --- 1. 建立場景 ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(GameConfig.world.backgroundColor);
    // 加入霧效：讓遠方物件淡入，營造景深與距離感
    this.scene.fog = new THREE.Fog(
      GameConfig.world.fogColor,
      GameConfig.world.fogNear,
      GameConfig.world.fogFar
    );

    // --- 2. 建立相機（駕駛艙視角）---
    this.camera = new THREE.PerspectiveCamera(
      GameConfig.camera.fov,
      window.innerWidth / window.innerHeight, // 長寬比
      GameConfig.camera.near,
      GameConfig.camera.far
    );
    const camPos = GameConfig.camera.position;
    this.camera.position.set(camPos.x, camPos.y, camPos.z);
    // 相機朝向 -Z 方向看出去（Three.js 預設前方），敵人會從 -Z 遠方接近。
    // 加入基準俯角：看向前方且略微向下的一個點，讓玩家同時看到
    // 遠方地平線與下方地面，形成駕駛艙俯瞰視野。
    const lookDistance = 400; // 注視點在前方的水平距離
    const lookY = camPos.y - Math.tan(GameConfig.camera.basePitch) * lookDistance;
    this.camera.lookAt(0, lookY, -lookDistance);

    // --- 3. 建立渲染器 ---
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, // 抗鋸齒，畫面更平滑
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // 限制像素比避免高解析螢幕上效能過重
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // --- 4. 光源 ---
    this.setupLights();

    // --- 5. 除錯輔助（第一階段用來確認場景正常運作）---
    if (GameConfig.debug.showAxesHelper) {
      const axes = new THREE.AxesHelper(50);
      this.scene.add(axes);
    }

    // --- 6. 監聽視窗縮放 ---
    window.addEventListener('resize', this.onResize);
  }

  /** 建立場景光源：環境光 + 平行光（模擬太陽） */
  private setupLights(): void {
    // 環境光：均勻照亮整體，避免陰影處全黑
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    // 平行光：提供方向性照明與立體感
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(100, 200, 50);
    this.scene.add(sun);
  }

  /** 視窗大小改變時，更新相機比例與渲染器尺寸 */
  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  /** 執行一次渲染（由 GameManager 的主迴圈每幀呼叫） */
  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** 釋放資源（遊戲關閉時呼叫） */
  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
