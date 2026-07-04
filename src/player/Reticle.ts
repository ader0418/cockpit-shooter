/**
 * Reticle.ts
 * ------------------------------------------------------------
 * 準心（十字準星）。以 HTML/CSS 元素呈現，疊在 HUD 層上。
 *
 * 設計上準心固定在畫面正中央，代表戰機機首（也就是子彈射出的）方向。
 * 玩家透過機身微調（PlayerController 讓相機小幅擺動）來改變機首朝向，
 * 因此「準心中心 = 相機正前方 = 子彈飛行方向」三者一致，射擊才會準。
 *
 * 之後（第六階段之後）若追蹤飛彈鎖定敵人，可再擴充「鎖定框」樣式。
 * ------------------------------------------------------------
 */

export class Reticle {
  /** 準心的根 DOM 元素 */
  private readonly el: HTMLElement;

  /**
   * @param hudRoot HUD 容器（準心會被加進去）
   */
  constructor(hudRoot: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'reticle';
    // 以內嵌樣式繪製一個簡單的十字準星（之後可換成美術圖片）
    this.el.innerHTML = `
      <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="16" fill="none" stroke="#6fe8ff" stroke-width="1.5" opacity="0.8"/>
        <circle cx="30" cy="30" r="2" fill="#6fe8ff"/>
        <line x1="30" y1="4"  x2="30" y2="16" stroke="#6fe8ff" stroke-width="1.5"/>
        <line x1="30" y1="44" x2="30" y2="56" stroke="#6fe8ff" stroke-width="1.5"/>
        <line x1="4"  y1="30" x2="16" y2="30" stroke="#6fe8ff" stroke-width="1.5"/>
        <line x1="44" y1="30" x2="56" y2="30" stroke="#6fe8ff" stroke-width="1.5"/>
      </svg>
    `;
    // 定位在畫面正中央
    Object.assign(this.el.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none', // 不攔截滑鼠事件
      filter: 'drop-shadow(0 0 4px rgba(111,232,255,0.6))',
    });
    hudRoot.appendChild(this.el);
  }

  /** 顯示 / 隱藏準心（例如選單或 Game Over 時隱藏） */
  public setVisible(visible: boolean): void {
    this.el.style.display = visible ? 'block' : 'none';
  }

  /** 釋放資源 */
  public dispose(): void {
    this.el.remove();
  }
}
