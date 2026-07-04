/**
 * UIManager.ts
 * ------------------------------------------------------------
 * HUD（抬頭顯示器）管理器。負責繪製並更新駕駛艙儀表板，包含：
 *   - 分數 (Score) 與 最高分 (Hi-Score)
 *   - 血量條 (HP)，顏色隨血量由綠轉紅
 *   - 三格武器圖示（顯示彈藥，並高亮目前武器）
 *   - 關卡 (Stage) 與本關進度條
 *   - 過關提示「STAGE n」與 Game Over 覆蓋層
 *
 * HUD 以 HTML/CSS 疊在 3D 畫面之上（比畫在 canvas 內更清晰、好調樣式）。
 * GameManager 每幀把最新資料丟給 update()，UIManager 只負責「畫出來」，
 * 不含任何遊戲邏輯——關注點分離。
 * ------------------------------------------------------------
 */

/** 每幀傳給 HUD 的資料快照 */
export interface HudData {
  score: number;
  hiScore: number;
  hp: number;
  maxHp: number;
  stage: number;
  stageProgress: number; // 0~1
  weapons: {
    name: string;
    iconKey: string;
    ammo: number; // -1 代表無限
    active: boolean;
  }[];
}

export class UIManager {
  private readonly root: HTMLElement;

  // 動態更新的元素參考
  private scoreEl!: HTMLElement;
  private hiScoreEl!: HTMLElement;
  private hpFillEl!: HTMLElement;
  private hpTextEl!: HTMLElement;
  private stageEl!: HTMLElement;
  private stageFillEl!: HTMLElement;
  private weaponsContainer!: HTMLElement;
  private weaponSlots: {
    root: HTMLElement;
    ammo: HTMLElement;
  }[] = [];

  private bannerEl!: HTMLElement;
  private bannerTimer = 0;
  private gameOverEl!: HTMLElement;

  constructor(hudRoot: HTMLElement) {
    this.root = hudRoot;
    this.injectStyles();
    this.buildDashboard();
    this.buildBanner();
    this.buildGameOver();
  }

  // ============================================================
  //  樣式
  // ============================================================

  /** 注入 HUD 專用的 CSS（僅注入一次）。 */
  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .hud-corner {
        position: absolute; width: 46px; height: 46px;
        border-color: rgba(111,232,255,0.5); pointer-events: none;
      }
      .hud-corner.tl { top: 14px; left: 14px; border-top: 2px solid; border-left: 2px solid; }
      .hud-corner.tr { top: 14px; right: 14px; border-top: 2px solid; border-right: 2px solid; }
      .hud-corner.bl { bottom: 150px; left: 14px; border-bottom: 2px solid; border-left: 2px solid; }
      .hud-corner.br { bottom: 150px; right: 14px; border-bottom: 2px solid; border-right: 2px solid; }

      .hud-dashboard {
        position: absolute; left: 0; right: 0; bottom: 0; height: 140px;
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 30px; gap: 24px;
        background: linear-gradient(180deg, rgba(10,18,34,0.0) 0%, rgba(9,15,28,0.85) 35%, rgba(6,10,20,0.96) 100%);
        border-top: 2px solid rgba(111,232,255,0.35);
        box-shadow: inset 0 24px 60px rgba(0,0,0,0.5), 0 0 30px rgba(111,232,255,0.15);
        font-family: "Microsoft JhengHei", sans-serif; color: #cfe3ff;
      }
      .hud-panel { display: flex; flex-direction: column; gap: 6px; }
      .hud-label { font-size: 11px; letter-spacing: 2px; color: #6f88b0; }
      .hud-value { font-size: 26px; font-weight: 700; color: #eaf3ff; text-shadow: 0 0 8px rgba(111,232,255,0.4); font-variant-numeric: tabular-nums; }
      .hud-value.small { font-size: 18px; color: #a9c2e8; }

      .hud-center { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; }

      .hud-hp-wrap { width: 320px; }
      .hud-hp-track {
        width: 100%; height: 16px; border-radius: 8px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(111,232,255,0.3); overflow: hidden;
      }
      .hud-hp-fill { height: 100%; width: 100%; border-radius: 8px; transition: width 0.15s ease, background-color 0.3s ease; }
      .hud-hp-text { font-size: 12px; color: #a9c2e8; align-self: flex-end; }

      .hud-weapons { display: flex; gap: 12px; }
      .hud-weapon {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        width: 66px; padding: 6px 4px; border-radius: 8px;
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
        opacity: 0.55; transition: all 0.15s ease;
      }
      .hud-weapon.active {
        opacity: 1; border-color: rgba(111,232,255,0.9);
        background: rgba(111,232,255,0.12);
        box-shadow: 0 0 14px rgba(111,232,255,0.4);
      }
      .hud-weapon svg { width: 30px; height: 30px; }
      .hud-weapon-ammo { font-size: 12px; color: #cfe3ff; font-variant-numeric: tabular-nums; }

      .hud-stage-wrap { text-align: right; }
      .hud-stage-track { width: 120px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 4px; }
      .hud-stage-fill { height: 100%; width: 0%; background: #6fe8ff; transition: width 0.2s ease; }

      .hud-banner {
        position: absolute; left: 50%; top: 30%; transform: translate(-50%,-50%);
        font-family: "Microsoft JhengHei", sans-serif; font-size: 44px; letter-spacing: 8px;
        color: #6fe8ff; text-shadow: 0 0 16px rgba(111,232,255,0.8);
        opacity: 0; transition: opacity 0.4s ease; pointer-events: none; text-align: center;
      }

      .hud-gameover {
        position: absolute; inset: 0; display: none;
        flex-direction: column; align-items: center; justify-content: center; gap: 14px;
        background: rgba(5,7,13,0.72); font-family: "Microsoft JhengHei", sans-serif; pointer-events: none;
      }
      .hud-gameover .go-title { font-size: 52px; letter-spacing: 8px; color: #ff6b6b; text-shadow: 0 0 20px rgba(255,80,80,0.6); }
      .hud-gameover .go-line { font-size: 20px; color: #d8e6ff; }
      .hud-gameover .go-hint { font-size: 16px; color: #9fb2d4; margin-top: 12px; }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  //  建立 DOM
  // ============================================================

  /** 建立駕駛艙儀表板與四角框線。 */
  private buildDashboard(): void {
    // 四角艙罩框線（營造座艙感）
    for (const pos of ['tl', 'tr', 'bl', 'br']) {
      const c = document.createElement('div');
      c.className = `hud-corner ${pos}`;
      this.root.appendChild(c);
    }

    const dash = document.createElement('div');
    dash.className = 'hud-dashboard';

    // --- 左：分數 / 最高分 ---
    const left = document.createElement('div');
    left.className = 'hud-panel';
    left.innerHTML = `
      <div><div class="hud-label">SCORE 分數</div><div class="hud-value" data-score>0</div></div>
      <div><div class="hud-label">HI-SCORE 最高</div><div class="hud-value small" data-hiscore>0</div></div>
    `;
    dash.appendChild(left);

    // --- 中：血量條 + 武器 ---
    const center = document.createElement('div');
    center.className = 'hud-center';
    center.innerHTML = `
      <div class="hud-hp-wrap">
        <div class="hud-label">HP 血量</div>
        <div class="hud-hp-track"><div class="hud-hp-fill" data-hpfill></div></div>
        <div class="hud-hp-text" data-hptext>100 / 100</div>
      </div>
      <div class="hud-weapons" data-weapons></div>
    `;
    dash.appendChild(center);

    // --- 右：關卡 ---
    const right = document.createElement('div');
    right.className = 'hud-panel hud-stage-wrap';
    right.innerHTML = `
      <div class="hud-label">STAGE 關卡</div>
      <div class="hud-value" data-stage>1</div>
      <div class="hud-stage-track"><div class="hud-stage-fill" data-stagefill></div></div>
    `;
    dash.appendChild(right);

    this.root.appendChild(dash);

    // 快取動態元素
    this.scoreEl = dash.querySelector('[data-score]')!;
    this.hiScoreEl = dash.querySelector('[data-hiscore]')!;
    this.hpFillEl = dash.querySelector('[data-hpfill]')!;
    this.hpTextEl = dash.querySelector('[data-hptext]')!;
    this.stageEl = dash.querySelector('[data-stage]')!;
    this.stageFillEl = dash.querySelector('[data-stagefill]')!;
    this.weaponsContainer = dash.querySelector('[data-weapons]')!;
  }

  /** 依武器數量建立武器格（只建立一次，之後只更新內容）。 */
  private ensureWeaponSlots(count: number): void {
    if (this.weaponSlots.length === count) return;
    this.weaponsContainer.innerHTML = '';
    this.weaponSlots = [];
    for (let i = 0; i < count; i++) {
      const slot = document.createElement('div');
      slot.className = 'hud-weapon';
      const ammo = document.createElement('div');
      ammo.className = 'hud-weapon-ammo';
      slot.innerHTML = `<div class="hud-weapon-key">${i + 1}</div>`;
      slot.appendChild(ammo);
      this.weaponsContainer.appendChild(slot);
      this.weaponSlots.push({ root: slot, ammo });
    }
  }

  /** 建立過關提示元素。 */
  private buildBanner(): void {
    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'hud-banner';
    this.root.appendChild(this.bannerEl);
  }

  /** 建立 Game Over 覆蓋層。 */
  private buildGameOver(): void {
    this.gameOverEl = document.createElement('div');
    this.gameOverEl.className = 'hud-gameover';
    this.root.appendChild(this.gameOverEl);
  }

  // ============================================================
  //  武器圖示（程式繪製的 SVG，之後可替換為美術素材）
  // ============================================================

  /** 依 iconKey 回傳對應武器圖示的 SVG 字串。 */
  private getWeaponIcon(iconKey: string): string {
    const stroke = 'stroke="#cfe3ff" stroke-width="2" fill="none" stroke-linecap="round"';
    switch (iconKey) {
      case 'icon_machinegun':
        // 機關槍：槍管 + 彈匣
        return `<svg viewBox="0 0 32 32"><path ${stroke} d="M3 12h20l4 3M7 12v6M11 18h6"/></svg>`;
      case 'icon_missile':
        // 飛彈：彈體 + 尾翼
        return `<svg viewBox="0 0 32 32"><path ${stroke} d="M5 16h16l6 0M21 16l-4-4M21 16l-4 4M5 16l-2-3M5 16l-2 3"/></svg>`;
      case 'icon_laser':
        // 雷射：光束 + 放射
        return `<svg viewBox="0 0 32 32"><path ${stroke} d="M3 16h26M22 10l4 6-4 6M8 12v8"/></svg>`;
      default:
        return `<svg viewBox="0 0 32 32"><circle ${stroke} cx="16" cy="16" r="8"/></svg>`;
    }
  }

  // ============================================================
  //  每幀更新
  // ============================================================

  /**
   * 更新 HUD 內容。
   * @param delta 距離上一影格的秒數（用於過關提示淡出）
   * @param data  本幀資料快照
   */
  public update(delta: number, data: HudData): void {
    // 分數 / 最高分
    this.scoreEl.textContent = String(data.score);
    this.hiScoreEl.textContent = String(data.hiScore);

    // 血量條：寬度依比例，顏色由綠(高)轉黃轉紅(低)
    const ratio = data.maxHp > 0 ? Math.max(0, data.hp / data.maxHp) : 0;
    this.hpFillEl.style.width = `${ratio * 100}%`;
    this.hpFillEl.style.backgroundColor = this.hpColor(ratio);
    this.hpTextEl.textContent = `${Math.round(data.hp)} / ${data.maxHp}`;

    // 關卡
    this.stageEl.textContent = String(data.stage);
    this.stageFillEl.style.width = `${Math.min(1, data.stageProgress) * 100}%`;

    // 武器格
    this.ensureWeaponSlots(data.weapons.length);
    data.weapons.forEach((w, i) => {
      const slot = this.weaponSlots[i];
      // 圖示（只在尚未繪製時插入，避免每幀重建 DOM）
      if (!slot.root.querySelector('svg')) {
        slot.root.insertAdjacentHTML('afterbegin', this.getWeaponIcon(w.iconKey));
      }
      slot.root.classList.toggle('active', w.active);
      slot.ammo.textContent = w.ammo === -1 ? '∞' : String(w.ammo);
    });

    // 過關提示淡出
    if (this.bannerTimer > 0) {
      this.bannerTimer -= delta;
      if (this.bannerTimer <= 0) this.bannerEl.style.opacity = '0';
    }
  }

  /** 依血量比例回傳顏色（綠→黃→紅）。 */
  private hpColor(ratio: number): string {
    if (ratio > 0.5) return '#54e08a'; // 綠
    if (ratio > 0.25) return '#f5c542'; // 黃
    return '#ff5a5a'; // 紅
  }

  // ============================================================
  //  提示與覆蓋層
  // ============================================================

  /** 顯示「STAGE n」過關提示。 */
  public showStageBanner(stage: number): void {
    this.bannerEl.textContent = `STAGE ${stage}`;
    this.bannerEl.style.opacity = '1';
    this.bannerTimer = 2.0;
  }

  /** 顯示 Game Over 覆蓋層。 */
  public showGameOver(score: number, hiScore: number): void {
    this.gameOverEl.innerHTML = `
      <div class="go-title">GAME OVER</div>
      <div class="go-line">最終分數：${score}</div>
      <div class="go-line">最高分：${hiScore}</div>
      <div class="go-hint">按 R 重新開始</div>
    `;
    this.gameOverEl.style.display = 'flex';
  }

  /** 隱藏 Game Over 覆蓋層。 */
  public hideGameOver(): void {
    this.gameOverEl.style.display = 'none';
  }

  /** 釋放資源 */
  public dispose(): void {
    this.gameOverEl.remove();
    this.bannerEl.remove();
    // 儀表板與角框線一併移除
    this.root.querySelectorAll('.hud-dashboard, .hud-corner').forEach((el) => el.remove());
  }
}
