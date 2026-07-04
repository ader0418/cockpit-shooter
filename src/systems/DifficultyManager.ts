/**
 * DifficultyManager.ts
 * ------------------------------------------------------------
 * 難度管理器。依目前關卡，用 EnemyConfig 中的難度曲線參數，
 * 計算出敵人的生成間隔、血量倍率、速度倍率與是否開放菁英，
 * 再套用到 EnemySpawner。
 *
 * 成長方式為複利：某項數值 = 基準值 × (每關倍率 ^ (關卡 - 1))。
 * 例如血量倍率每關 ×1.15，第三關就是 1.15^2 ≈ 1.32 倍。
 * 難度公式集中在此，之後要調整難度曲線只需改 EnemyConfig。
 * ------------------------------------------------------------
 */

import { EnemySpawner, DifficultyParams } from '../enemies/EnemySpawner';
import { DifficultyCurve } from '../config/EnemyConfig';

export class DifficultyManager {
  private readonly spawner: EnemySpawner;

  constructor(spawner: EnemySpawner) {
    this.spawner = spawner;
  }

  /**
   * 依關卡計算難度參數。
   * @param stage 目前關卡（從 1 起算）
   */
  public computeParams(stage: number): DifficultyParams {
    const s = Math.max(1, stage) - 1; // 指數（第一關為 0）

    // 生成間隔：每關縮短，但不低於下限（避免無限變快）
    const spawnInterval = Math.max(
      DifficultyCurve.minSpawnInterval,
      DifficultyCurve.baseSpawnInterval *
        Math.pow(DifficultyCurve.spawnIntervalMultiplierPerStage, s)
    );

    return {
      spawnInterval,
      hpMul: Math.pow(DifficultyCurve.hpMultiplierPerStage, s),
      speedMul: Math.pow(DifficultyCurve.speedMultiplierPerStage, s),
      // 到達指定關卡才開始出現菁英怪
      allowElite: stage >= DifficultyCurve.eliteUnlockStage,
    };
  }

  /**
   * 設定關卡並立即套用對應難度到生成器。
   * @param stage 目前關卡
   */
  public setStage(stage: number): void {
    const params = this.computeParams(stage);
    this.spawner.applyDifficulty(params);
    console.log(
      `[DifficultyManager] 第 ${stage} 關難度：生成間隔 ${params.spawnInterval.toFixed(
        2
      )}s、血量 ×${params.hpMul.toFixed(2)}、速度 ×${params.speedMul.toFixed(
        2
      )}、菁英 ${params.allowElite ? '開放' : '未開放'}`
    );
  }
}
