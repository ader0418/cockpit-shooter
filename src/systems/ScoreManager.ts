/**
 * ScoreManager.ts
 * ------------------------------------------------------------
 * 計分系統。追蹤目前分數與最高分。
 * 最高分的「持久化儲存」（存到 localStorage）由第十階段的
 * SaveManager 負責；本類別只負責記憶體中的分數邏輯，並在
 * 分數超越最高分時即時更新，供 HUD 顯示。
 * ------------------------------------------------------------
 */

export class ScoreManager {
  /** 本局目前分數 */
  private score = 0;
  /** 歷史最高分（由 SaveManager 載入初始值，第十階段接上） */
  private hiScore = 0;

  /** 增加分數，並在超越最高分時同步更新 hiScore。 */
  public add(points: number): void {
    this.score += points;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
    }
  }

  /** 目前分數 */
  public getScore(): number {
    return this.score;
  }

  /** 最高分 */
  public getHiScore(): number {
    return this.hiScore;
  }

  /** 設定最高分初始值（由 SaveManager 於載入存檔後呼叫）。 */
  public setHiScore(value: number): void {
    this.hiScore = value;
  }

  /** 重置本局分數（重新開始遊戲時用；hiScore 不重置）。 */
  public reset(): void {
    this.score = 0;
  }
}
