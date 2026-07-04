/**
 * GameManager.ts
 * ------------------------------------------------------------
 * 遊戲的中樞（大腦）。負責：
 *   1. 建立並持有所有子系統（目前只有 SceneManager，之後會陸續加入
 *      InputManager、PlayerController、WeaponController、EnemySpawner…）。
 *   2. 執行主迴圈（game loop）：以 requestAnimationFrame 每幀更新與渲染。
 *   3. 管理遊戲狀態機（State Machine）：BOOT / MENU / PLAYING / PAUSED / GAME_OVER。
 *
 * 狀態機的意義：不同狀態下「該更新什麼、該顯示什麼」不同。
 * 例如 PAUSED 時遊戲邏輯凍結但畫面仍渲染；MENU 時不更新敵人。
 * 把狀態集中管理，之後接 UI（開始鈕、暫停、Game Over 畫面）會很乾淨。
 * ------------------------------------------------------------
 */

import { SceneManager } from './SceneManager';
import { EnvironmentManager } from './EnvironmentManager';
import { InputManager } from './InputManager';
import { PlayerController } from '../player/PlayerController';
import { Reticle } from '../player/Reticle';
import { ProjectileManager } from '../weapons/ProjectileManager';
import { WeaponController } from '../weapons/WeaponController';
import { EnemySpawner } from '../enemies/EnemySpawner';
import { Enemy } from '../enemies/Enemy';
import { EnemyType } from '../config/EnemyConfig';
import { ScoreManager } from '../systems/ScoreManager';
import { EffectsManager } from '../systems/EffectsManager';
import { CollisionSystem } from '../systems/CollisionSystem';
import { StageManager } from '../systems/StageManager';
import { DifficultyManager } from '../systems/DifficultyManager';
import { UIManager, HudData } from '../ui/UIManager';
import { SaveManager } from '../save/SaveManager';

/** 遊戲狀態列舉 */
export enum GameState {
  Boot = 'boot', // 初始化中
  Menu = 'menu', // 主選單（等待開始）
  Playing = 'playing', // 遊戲進行中
  Paused = 'paused', // 暫停
  GameOver = 'gameover', // 遊戲結束
}

export class GameManager {
  /** 場景管理器 */
  private sceneManager: SceneManager;
  /** 環境管理器（地面 / 背景視差） */
  private environmentManager: EnvironmentManager;
  /** 輸入管理器 */
  private inputManager: InputManager;
  /** 玩家控制器（瞄準 / 血量） */
  private playerController: PlayerController;
  /** 準心 */
  private reticle: Reticle;
  /** 彈藥管理器 */
  private projectileManager: ProjectileManager;
  /** 武器控制器 */
  private weaponController: WeaponController;
  /** 敵人生成器 */
  private enemySpawner: EnemySpawner;
  /** 計分管理器 */
  private scoreManager: ScoreManager;
  /** 特效管理器（爆炸） */
  private effectsManager: EffectsManager;
  /** 碰撞系統 */
  private collisionSystem: CollisionSystem;
  /** 關卡管理器 */
  private stageManager: StageManager;
  /** 難度管理器 */
  private difficultyManager: DifficultyManager;
  /** 存檔管理器 */
  private saveManager: SaveManager;

  /** HUD 管理器（駕駛艙儀表板） */
  private uiManager: UIManager;

  /** 目前遊戲狀態 */
  private state: GameState = GameState.Boot;

  /** requestAnimationFrame 用來計算每幀時間差（delta time）的時間戳 */
  private lastTime = 0;
  /** rAF 的 handle，用於停止迴圈 */
  private rafId = 0;

  /** 累積遊玩時間（秒），之後計分／過關可能用到 */
  private elapsedTime = 0;

  /**
   * @param container 放置遊戲畫面的 DOM 容器
   */
  constructor(container: HTMLElement) {
    // 建立場景系統
    this.sceneManager = new SceneManager(container);
    // 建立環境系統（把地面等物件加入場景）
    this.environmentManager = new EnvironmentManager(this.sceneManager.scene);
    // 建立輸入系統
    this.inputManager = new InputManager();
    // 建立玩家控制器（操控場景相機做瞄準）
    this.playerController = new PlayerController(
      this.sceneManager.camera,
      this.inputManager
    );

    // 建立準心與 HUD，加入 HUD 層
    const hudRoot = document.getElementById('hud-root');
    if (!hudRoot) throw new Error('[GameManager] 找不到 #hud-root。');
    this.reticle = new Reticle(hudRoot);
    this.uiManager = new UIManager(hudRoot);

    // 建立彈藥管理器
    this.projectileManager = new ProjectileManager(this.sceneManager.scene);

    // 建立敵人生成器（同時作為追蹤飛彈的目標提供者）
    this.enemySpawner = new EnemySpawner(this.sceneManager.scene);

    // 建立武器控制器，目標提供者接上敵人生成器 → 追蹤飛彈可鎖定敵人
    this.weaponController = new WeaponController(
      this.inputManager,
      this.projectileManager,
      this.enemySpawner
    );

    // 建立計分與特效
    this.scoreManager = new ScoreManager();
    this.effectsManager = new EffectsManager(this.sceneManager.scene);

    // 建立碰撞系統，並設定「擊毀」「玩家受擊」的後續處理
    this.collisionSystem = new CollisionSystem(
      this.projectileManager,
      this.enemySpawner,
      this.playerController,
      {
        // 敵人被擊毀：加分 + 在敵人位置放爆炸
        onEnemyDestroyed: (enemy: Enemy) => {
          this.scoreManager.add(enemy.getScoreValue());
          this.spawnExplosionFor(enemy);
        },
        // 敵人撞上玩家：在玩家附近放爆炸（扣血已在碰撞系統內處理）
        onPlayerHit: (enemy: Enemy) => {
          this.spawnExplosionFor(enemy);
        },
      }
    );

    // 建立關卡與難度管理器
    this.stageManager = new StageManager();
    this.difficultyManager = new DifficultyManager(this.enemySpawner);

    // 建立存檔管理器，載入紀錄並套用到計分與關卡（最高分、最高關卡）
    this.saveManager = new SaveManager();
    const saved = this.saveManager.load();
    this.scoreManager.setHiScore(saved.hiScore);
    this.stageManager.setMaxStageReached(saved.maxStage);

    // 過關時：調升難度、補滿追蹤飛彈作為獎勵、顯示過關提示、存檔進度
    this.stageManager.onStageUp = (newStage: number) => {
      this.difficultyManager.setStage(newStage);
      this.weaponController.refillAmmo();
      this.uiManager.showStageBanner(newStage);
      this.saveProgress(); // 過關即存檔，避免中途關閉遺失最高關卡
    };
    // 初始化第一關難度
    this.difficultyManager.setStage(1);
  }

  /** 將目前的最高分與最高關卡寫入存檔。 */
  private saveProgress(): void {
    this.saveManager.save({
      version: 1,
      hiScore: this.scoreManager.getHiScore(),
      maxStage: this.stageManager.getMaxStageReached(),
    });
  }

  /** 依敵種在其位置產生對應大小與顏色的爆炸。 */
  private spawnExplosionFor(enemy: Enemy): void {
    const size = enemy.getRadius() * 2.6;
    // 菁英怪爆紫色，其餘爆橘色
    const color = enemy.type === EnemyType.Elite ? 0xd06aff : 0xffa53a;
    this.effectsManager.spawn(enemy.getPosition(), size, color);
  }

  /**
   * 啟動遊戲：完成初始化 → 進入選單 → 開始主迴圈。
   * 目前第一階段為了驗證，會直接建立測試方塊並進入 Playing 狀態。
   */
  public start(): void {
    // 隱藏 HTML 的開場載入畫面
    const boot = document.getElementById('boot-screen');
    if (boot) boot.classList.add('hidden');

    // 第一階段先直接進入 Playing，之後接上選單 UI 再改回 Menu
    this.setState(GameState.Playing);

    // 啟動主迴圈
    this.lastTime = performance.now();
    this.loop(this.lastTime);

    console.log('[GameManager] 遊戲已啟動，主迴圈執行中。');
  }

  /**
   * 主迴圈：每一影格由瀏覽器呼叫一次。
   * @param now 由 requestAnimationFrame 傳入的高精度時間戳（毫秒）
   */
  private loop = (now: number): void => {
    // 計算距離上一影格的時間差（秒）。用 delta time 讓移動速度不受幀率影響。
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // 依目前狀態更新邏輯
    this.update(delta);

    // 渲染畫面（任何狀態都渲染，暫停時畫面仍在但邏輯凍結）
    this.sceneManager.render();

    // 每幀最後清除「剛按下」的輸入紀錄，準備下一幀
    this.inputManager.postUpdate();

    // 預約下一影格
    this.rafId = requestAnimationFrame(this.loop);
  };

  /**
   * 依狀態分派更新邏輯。
   * @param delta 距離上一影格的秒數
   */
  private update(delta: number): void {
    switch (this.state) {
      case GameState.Playing:
        this.elapsedTime += delta;
        this.updateGameplay(delta);
        break;

      case GameState.GameOver:
        this.updateGameOver();
        break;

      case GameState.Menu:
      case GameState.Paused:
      case GameState.Boot:
        // 這些狀態目前不更新遊戲邏輯（之後可加選單動畫等）
        break;
    }
  }

  /**
   * 遊戲進行中的核心更新。
   * 之後這裡會依序呼叫：
   *   input.update() → player.update() → weapon.update()
   *   → enemySpawner.update() → collision.update() → ui.update() …
   * 更新所有遊戲系統，並處理碰撞與 Game Over 判定。
   * @param delta 距離上一影格的秒數
   */
  private updateGameplay(delta: number): void {
    this.environmentManager.update(delta);
    this.playerController.update(delta);
    // 武器控制器：處理切換與開火（射擊起點/方向取自相機）
    this.weaponController.update(delta, this.sceneManager.camera);
    // 彈藥飛行與回收
    this.projectileManager.update(delta);
    // 敵人生成、移動與回收（傳入玩家位置供追向型敵人使用）
    const playerPos = this.sceneManager.camera.position;
    this.enemySpawner.update(delta, playerPos);
    // 碰撞判定（彈藥↔敵人、敵人↔玩家）
    this.collisionSystem.update(playerPos);
    // 爆炸特效更新
    this.effectsManager.update(delta);
    // 關卡過關判定（分數或存活時間）
    this.stageManager.update(delta, this.scoreManager.getScore());
    // 更新駕駛艙儀表板 HUD
    this.uiManager.update(delta, this.buildHudData());

    // Game Over 判定：玩家血量歸零
    if (this.playerController.isDead()) {
      this.setState(GameState.GameOver);
      this.saveProgress(); // 存檔：保存本局可能刷新的最高分
      this.uiManager.showGameOver(
        this.scoreManager.getScore(),
        this.scoreManager.getHiScore()
      );
      this.reticle.setVisible(false);
    }
  }

  /** 蒐集本幀資料，組成 HUD 需要的快照。 */
  private buildHudData(): HudData {
    const score = this.scoreManager.getScore();
    const currentIndex = this.weaponController.getCurrentIndex();
    // 從武器控制器取得三把武器的顯示資訊
    const weapons = this.weaponController.getWeaponsInfo().map((w, i) => ({
      name: w.name,
      iconKey: w.iconKey,
      ammo: w.ammo,
      active: i === currentIndex,
    }));

    return {
      score,
      hiScore: this.scoreManager.getHiScore(),
      hp: this.playerController.getHp(),
      maxHp: this.playerController.getMaxHp(),
      stage: this.stageManager.getStage(),
      stageProgress: this.stageManager.getStageProgress(score),
      weapons,
    };
  }

  /** GameOver 狀態下等待玩家按 R 重新開始。 */
  private updateGameOver(): void {
    if (this.inputManager.consumePressed('KeyR')) {
      this.restart();
    }
  }

  /**
   * 切換遊戲狀態。集中在一處處理狀態轉換，方便日後加入
   * 「進入某狀態時要做的事」（例如進入 GameOver 時存檔、顯示結算畫面）。
   * @param next 目標狀態
   */
  public setState(next: GameState): void {
    if (this.state === next) return;
    console.log(`[GameManager] 狀態轉換：${this.state} → ${next}`);
    this.state = next;

    // 預留：日後在此處理各狀態的進入行為
    // 例如：
    // if (next === GameState.GameOver) { this.saveManager.saveHiScore(...); }
  }

  /** 取得目前狀態（供 UI 或其他系統查詢） */
  public getState(): GameState {
    return this.state;
  }

  /** 停止遊戲並釋放資源 */
  public dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.inputManager.dispose();
    this.reticle.dispose();
    this.uiManager.dispose();
    this.projectileManager.dispose();
    this.effectsManager.dispose();
    this.environmentManager.dispose();
    this.sceneManager.dispose();
  }

  /** 重新開始遊戲：重置所有系統回到初始狀態。 */
  public restart(): void {
    this.playerController.reset();
    this.weaponController.reset();
    this.projectileManager.clear();
    this.enemySpawner.reset();
    this.effectsManager.clear();
    this.scoreManager.reset();
    this.stageManager.reset();
    this.difficultyManager.setStage(1);
    this.reticle.setVisible(true);
    this.uiManager.hideGameOver();
    this.setState(GameState.Playing);
  }
}
