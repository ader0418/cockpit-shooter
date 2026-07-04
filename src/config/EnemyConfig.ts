/**
 * EnemyConfig.ts
 * ------------------------------------------------------------
 * 敵人基礎數值 + 難度曲線參數。
 * - 每種敵人有「第一關的基準值」。
 * - DifficultyManager（第八階段）會依關卡把基準值乘上倍率，
 *   達成「越後面的關卡敵人越強、生成越快」。
 * ------------------------------------------------------------
 */

/** 敵人種類列舉 */
export enum EnemyType {
  Aircraft = 'aircraft', // 空中戰機
  Tank = 'tank', // 地面坦克
  Elite = 'elite', // 菁英怪（攻擊模式更複雜）
}

/** 單一敵人種類的基準數值（第一關的值） */
export interface EnemySpec {
  type: EnemyType;
  displayName: string;
  baseHp: number; // 基準血量
  baseSpeed: number; // 基準移動速度（朝玩家靠近，單位／秒）
  scoreValue: number; // 擊毀可得分數
  contactDamage: number; // 撞到玩家時對玩家造成的傷害
  modelKey: string; // 對應 AssetManager 的模型 key
  spawnWeight: number; // 生成權重（越大越常出現）
}

/** 各敵種基準值 */
export const EnemyConfig: Record<EnemyType, EnemySpec> = {
  [EnemyType.Aircraft]: {
    type: EnemyType.Aircraft,
    displayName: '敵方戰機',
    baseHp: 20,
    baseSpeed: 60,
    scoreValue: 100,
    contactDamage: 15,
    modelKey: 'enemy_aircraft',
    spawnWeight: 6,
  },
  [EnemyType.Tank]: {
    type: EnemyType.Tank,
    displayName: '地面坦克',
    baseHp: 40,
    baseSpeed: 25,
    scoreValue: 150,
    contactDamage: 20,
    modelKey: 'enemy_tank',
    spawnWeight: 3,
  },
  [EnemyType.Elite]: {
    type: EnemyType.Elite,
    displayName: '菁英單位',
    baseHp: 120,
    baseSpeed: 45,
    scoreValue: 500,
    contactDamage: 30,
    modelKey: 'enemy_elite',
    spawnWeight: 1, // 較稀有
  },
};

/**
 * 難度曲線設定。
 * 每提升一關，套用以下倍率（以第一關為基準的複利成長）：
 *   實際值 = 基準值 × (倍率 ^ (關卡 - 1))
 */
export const DifficultyCurve = {
  hpMultiplierPerStage: 1.15, // 每關血量 ×1.15
  speedMultiplierPerStage: 1.08, // 每關速度 ×1.08
  /** 生成間隔每關縮短的比例（越小＝生成越密集），設下限避免無限變快 */
  spawnIntervalMultiplierPerStage: 0.9,
  minSpawnInterval: 0.4, // 生成間隔下限（秒）
  baseSpawnInterval: 2.0, // 第一關的生成間隔（秒）

  /** 菁英怪從第幾關開始有機會出現 */
  eliteUnlockStage: 3,
} as const;
