/**
 * StageManager.ts
 * ------------------------------------------------------------
 * 關卡管理器。負責判定過關與推進關卡。
 *
 * 過關條件（滿足任一即過關，對應需求的「分數或存活時間」）：
 *   1. 本關累積的擊殺分數達到目標（目標隨關卡遞增）。
 *   2. 或在本關存活達到指定秒數。
 *
 * 過關時透過 onStageUp 回呼通知外部（GameManager），
 * 由外部去調升難度、獎勵補彈、顯示過關提示等。
 * 也記錄「達到的最高關卡」，供第十階段存檔使用。
 * ------------------------------------------------------------
 */

import { GameConfig } from '../config/GameConfig';

export class StageManager {
  /** 目前關卡（從 1 起算） */
  private stage = 1;
  /** 歷史達到的最高關卡（供存檔） */
  private maxStageReached = 1;

  /** 進入本關時的分數（用來計算本關已累積的擊殺分數） */
  private scoreAtStageStart = 0;
  /** 本關已經過的時間（秒） */
  private stageElapsed = 0;

  /** 過關回呼：參數為「新關卡編號」 */
  public onStageUp?: (newStage: number) => void;

  /**
   * 每幀更新，檢查是否達成過關條件。
   * @param delta        距離上一影格的秒數
   * @param currentScore 目前總分
   */
  public update(delta: number, currentScore: number): void {
    this.stageElapsed += delta;

    const goal = this.getScoreGoal();
    const gained = currentScore - this.scoreAtStageStart;

    // 條件一：本關擊殺分數達標；條件二：本關存活時間達標
    if (gained >= goal || this.stageElapsed >= GameConfig.stage.timeGoal) {
      this.advance(currentScore);
    }
  }

  /** 推進到下一關並重置本關進度。 */
  private advance(currentScore: number): void {
    this.stage += 1;
    this.maxStageReached = Math.max(this.maxStageReached, this.stage);
    this.scoreAtStageStart = currentScore;
    this.stageElapsed = 0;
    this.onStageUp?.(this.stage);
  }

  /** 本關的分數目標（隨關卡複利遞增）。 */
  private getScoreGoal(): number {
    return (
      GameConfig.stage.scoreGoalBase *
      Math.pow(GameConfig.stage.scoreGoalGrowth, this.stage - 1)
    );
  }

  /** 本關進度（0~1），供 HUD 顯示進度條。 */
  public getStageProgress(currentScore: number): number {
    const goal = this.getScoreGoal();
    const gained = currentScore - this.scoreAtStageStart;
    const byScore = goal > 0 ? gained / goal : 0;
    const byTime = this.stageElapsed / GameConfig.stage.timeGoal;
    // 取兩種進度較大者（哪個先滿就以哪個為準）
    return Math.min(1, Math.max(byScore, byTime));
  }

  /** 目前關卡 */
  public getStage(): number {
    return this.stage;
  }

  /** 達到的最高關卡（供存檔） */
  public getMaxStageReached(): number {
    return this.maxStageReached;
  }

  /** 設定最高關卡初始值（由 SaveManager 於載入存檔後呼叫）。 */
  public setMaxStageReached(value: number): void {
    this.maxStageReached = Math.max(1, value);
  }

  /** 重置到第一關（重新開始遊戲時用；最高關卡紀錄不重置）。 */
  public reset(): void {
    this.stage = 1;
    this.scoreAtStageStart = 0;
    this.stageElapsed = 0;
  }
}
