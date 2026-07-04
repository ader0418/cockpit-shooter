/**
 * WeaponController.ts
 * ------------------------------------------------------------
 * 武器控制器。負責：
 *   - 依 WeaponConfig 建立三種武器實例（機關槍 / 追蹤飛彈 / 雷射砲）。
 *   - 處理切換輸入：數字鍵 1/2/3 直接選、Q/E 循環切換。
 *   - 處理開火輸入：按住開火鍵且目前武器可開火時，呼叫 weapon.fire()。
 *
 * 控制器本身不知道各武器「怎麼射」——那是各 Weapon 子類的職責（多型）。
 * 之後要加第四種武器，只要在 WeaponConfig 加設定、在這裡的工廠對應即可。
 * ------------------------------------------------------------
 */

import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { ProjectileManager } from './ProjectileManager';
import { TargetProvider } from './Targeting';
import { Weapon, FireContext } from './Weapon';
import { MachineGun } from './MachineGun';
import { HomingMissile } from './HomingMissile';
import { LaserCannon } from './LaserCannon';
import { WeaponConfig } from '../config/WeaponConfig';
import { GameConfig } from '../config/GameConfig';

export class WeaponController {
  private readonly input: InputManager;
  private readonly projectiles: ProjectileManager;
  private readonly targets: TargetProvider;

  /** 武器清單（順序對應 WeaponConfig 與數字鍵 1/2/3） */
  private readonly weapons: Weapon[];
  /** 目前選用的武器索引 */
  private currentIndex: number;

  /** 供每幀重複使用的暫存向量，避免頻繁配置記憶體 */
  private readonly tmpOrigin = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();

  constructor(
    input: InputManager,
    projectiles: ProjectileManager,
    targets: TargetProvider
  ) {
    this.input = input;
    this.projectiles = projectiles;
    this.targets = targets;

    // 依設定建立武器實例。用工廠把「設定 id」對應到「實作類別」。
    this.weapons = WeaponConfig.map((spec) => {
      switch (spec.id) {
        case 'machine_gun':
          return new MachineGun(spec);
        case 'homing_missile':
          return new HomingMissile(spec);
        case 'laser_cannon':
          return new LaserCannon(spec);
        default:
          // 未知 id 預設給機關槍，避免遊戲崩潰
          console.warn(`[WeaponController] 未知武器 id：${spec.id}，改用機關槍。`);
          return new MachineGun(spec);
      }
    });

    this.currentIndex = GameConfig.player.startWeaponIndex;
  }

  /**
   * 每幀更新。
   * @param delta  距離上一影格的秒數
   * @param camera 相機（用來取得射擊起點與方向）
   */
  public update(delta: number, camera: THREE.PerspectiveCamera): void {
    // 1) 所有武器更新冷卻（即使未選用，切換回來才不會有殘留冷卻異常）
    for (const w of this.weapons) w.update(delta);

    // 2) 處理切換輸入
    this.handleSwitchInput();

    // 3) 處理開火
    if (this.input.isFiring()) {
      const weapon = this.weapons[this.currentIndex];
      if (weapon.canFire()) {
        weapon.fire(this.buildFireContext(camera));
      }
    }
  }

  /** 處理武器切換：數字鍵直接選，Q/E 循環。 */
  private handleSwitchInput(): void {
    // 數字鍵 1/2/3
    if (this.input.consumePressed('Digit1')) this.switchTo(0);
    if (this.input.consumePressed('Digit2')) this.switchTo(1);
    if (this.input.consumePressed('Digit3')) this.switchTo(2);

    // Q 上一把、E 下一把（循環）
    if (this.input.consumePressed('KeyE')) this.cycle(1);
    if (this.input.consumePressed('KeyQ')) this.cycle(-1);
  }

  /** 切換到指定索引的武器 */
  public switchTo(index: number): void {
    if (index < 0 || index >= this.weapons.length) return;
    if (index === this.currentIndex) return;
    this.currentIndex = index;
    console.log(`[WeaponController] 切換武器：${this.getCurrentWeapon().getSpec().displayName}`);
  }

  /** 循環切換武器（dir = +1 下一把、-1 上一把） */
  private cycle(dir: number): void {
    const n = this.weapons.length;
    this.switchTo((this.currentIndex + dir + n) % n);
  }

  /** 組出開火情境（射擊起點與方向來自相機）。 */
  private buildFireContext(camera: THREE.PerspectiveCamera): FireContext {
    // 射擊方向＝相機正前方
    camera.getWorldDirection(this.tmpDir);
    // 射擊起點＝相機位置（機首）
    this.tmpOrigin.copy(camera.position);

    return {
      origin: this.tmpOrigin,
      direction: this.tmpDir,
      projectiles: this.projectiles,
      targets: this.targets,
    };
  }

  // --- 供 HUD 查詢的資訊 ---

  /** 取得目前武器 */
  public getCurrentWeapon(): Weapon {
    return this.weapons[this.currentIndex];
  }

  /** 取得目前武器索引 */
  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  /** 取得所有武器的顯示資訊（名稱、圖示 key、彈藥），供 HUD 使用。 */
  public getWeaponsInfo(): { name: string; iconKey: string; ammo: number }[] {
    return this.weapons.map((w) => ({
      name: w.getSpec().displayName,
      iconKey: w.getSpec().hudIconKey,
      ammo: w.getAmmo(),
    }));
  }

  /** 補滿所有武器彈藥（過關獎勵）。 */
  public refillAmmo(): void {
    for (const w of this.weapons) w.refill();
  }

  /** 重置所有武器（重新開始遊戲時用） */
  public reset(): void {
    for (const w of this.weapons) w.reset();
    this.currentIndex = GameConfig.player.startWeaponIndex;
  }
}
