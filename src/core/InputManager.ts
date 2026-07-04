/**
 * InputManager.ts
 * ------------------------------------------------------------
 * 輸入抽象層。把瀏覽器原始的鍵盤/滑鼠事件，轉換成遊戲邏輯
 * 好查詢的「狀態」，讓其他系統不必直接處理 DOM 事件。
 *
 * 提供三類查詢：
 *   1. isKeyDown(code)     —— 某鍵是否「正被按住」（持續性，如射擊、瞄準）。
 *   2. consumePressed(code)—— 某鍵這一幀是否「剛被按下」（一次性，如切武器）。
 *   3. pointer / isFiring  —— 滑鼠位置與是否開火。
 *
 * 使用方式：GameManager 每幀最後呼叫 postUpdate() 清除「剛按下」的紀錄。
 * ------------------------------------------------------------
 */

export class InputManager {
  /** 目前正被按住的按鍵集合（KeyboardEvent.code） */
  private keysDown = new Set<string>();
  /** 這一幀剛被按下的按鍵集合（供一次性觸發，如切換武器） */
  private keysPressed = new Set<string>();

  /**
   * 滑鼠指標的正規化座標（NDC 風格）：
   *   x：畫面最左 = -1，最右 = +1
   *   y：畫面最下 = -1，最上 = +1
   * 用正規化座標，瞄準邏輯就不受實際解析度影響。
   */
  public pointer = { x: 0, y: 0 };

  /** 滑鼠左鍵是否按住（開火用） */
  private mouseDown = false;

  constructor() {
    // 綁定事件（用箭頭函式確保 this 正確，之後才能正確移除監聽）
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    // 視窗失焦時清空所有按鍵狀態，避免「按住時切走再回來」造成鍵卡住
    window.addEventListener('blur', this.onBlur);
    // 停用右鍵選單，避免遊戲中誤觸
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // 只有從「未按下」變成「按下」時才記錄為 pressed（過濾作業系統的連續重複觸發）
    if (!this.keysDown.has(e.code)) {
      this.keysPressed.add(e.code);
    }
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    // 將像素座標轉為 -1..1 的正規化座標
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1); // Y 反向（螢幕往下為正）
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = true; // 0 = 左鍵
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false;
  };

  private onBlur = (): void => {
    this.keysDown.clear();
    this.keysPressed.clear();
    this.mouseDown = false;
  };

  /** 查詢某鍵是否正被按住 */
  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /**
   * 查詢並「消費」某鍵這一幀是否剛被按下。
   * 消費後同一幀再查會是 false，確保一次按下只觸發一次動作。
   */
  public consumePressed(code: string): boolean {
    if (this.keysPressed.has(code)) {
      this.keysPressed.delete(code);
      return true;
    }
    return false;
  }

  /** 是否正在開火（滑鼠左鍵或空白鍵） */
  public isFiring(): boolean {
    return this.mouseDown || this.isKeyDown('Space');
  }

  /** 每幀結束時呼叫：清除「剛按下」紀錄，準備下一幀 */
  public postUpdate(): void {
    this.keysPressed.clear();
  }

  /** 釋放資源：移除所有事件監聽 */
  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
