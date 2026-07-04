/**
 * WeaponConfig.ts
 * ------------------------------------------------------------
 * 三種武器的數值設定。武器邏輯（第五階段）會讀取這些參數，
 * 因此調整射速、傷害、冷卻、彈藥都在這裡改即可。
 * ------------------------------------------------------------
 */

/** 單一武器的參數結構 */
export interface WeaponSpec {
  id: string; // 武器唯一識別碼
  displayName: string; // 顯示在 HUD 上的名稱
  damage: number; // 單發傷害
  /** 兩次射擊之間的最小間隔（秒）。越小＝射速越快 */
  fireInterval: number;
  projectileSpeed: number; // 彈藥飛行速度（單位／秒）
  /** 彈藥數上限；-1 代表無限（例如機關槍） */
  maxAmmo: number;
  /** 是否具備自動鎖定能力（追蹤飛彈用） */
  homing: boolean;
  /** 是否為穿透彈（雷射用，可貫穿多個敵人） */
  piercing: boolean;
  hudIconKey: string; // 對應 AssetManager 中的武器圖示 key
}

/**
 * 武器清單（順序＝切換順序，也對應數字鍵 1/2/3）。
 * 數值僅為初版平衡，之後可自由調整。
 */
export const WeaponConfig: WeaponSpec[] = [
  {
    id: 'machine_gun',
    displayName: '機關槍',
    damage: 8,
    fireInterval: 0.09, // 射速快
    projectileSpeed: 900,
    maxAmmo: -1, // 無限彈藥、無冷卻
    homing: false,
    piercing: false,
    hudIconKey: 'icon_machinegun',
  },
  {
    id: 'homing_missile',
    displayName: '追蹤飛彈',
    damage: 45,
    fireInterval: 0.8, // 射速慢
    projectileSpeed: 320,
    maxAmmo: 12, // 有彈藥限制
    homing: true, // 自動鎖定敵機
    piercing: false,
    hudIconKey: 'icon_missile',
  },
  {
    id: 'laser_cannon',
    displayName: '雷射砲',
    damage: 60,
    fireInterval: 1.1, // 射擊間隔長
    projectileSpeed: 1400,
    maxAmmo: -1,
    homing: false,
    piercing: true, // 直線穿透多個敵人
    hudIconKey: 'icon_laser',
  },
];
