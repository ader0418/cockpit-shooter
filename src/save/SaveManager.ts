/**
 * SaveManager.ts
 * ------------------------------------------------------------
 * 本地存檔系統。使用瀏覽器的 localStorage 持久化玩家進度：
 *   - 最高分 (hiScore)
 *   - 達到的最高關卡 (maxStage)
 *
 * 設計重點：
 *   - 所有讀寫都包在 try/catch 中。localStorage 在無痕模式、
 *     隱私設定或某些環境下可能不可用，出錯時以預設值運作、
 *     不讓遊戲崩潰。
 *   - 存檔帶版本號 (version)，日後存檔格式若變動，可據此做遷移。
 * ------------------------------------------------------------
 */

/** 存檔資料結構 */
export interface SaveData {
  version: number; // 存檔格式版本
  hiScore: number; // 最高分
  maxStage: number; // 達到的最高關卡
}

export class SaveManager {
  /** localStorage 的鍵名 */
  private static readonly STORAGE_KEY = 'cockpit-shooter-save';
  /** 目前存檔格式版本 */
  private static readonly CURRENT_VERSION = 1;

  /** 預設（空）存檔 */
  private static defaultData(): SaveData {
    return { version: SaveManager.CURRENT_VERSION, hiScore: 0, maxStage: 1 };
  }

  /**
   * 讀取存檔。若不存在、損毀或環境不支援，回傳預設值。
   */
  public load(): SaveData {
    try {
      const raw = localStorage.getItem(SaveManager.STORAGE_KEY);
      if (!raw) return SaveManager.defaultData();

      const parsed = JSON.parse(raw) as Partial<SaveData>;
      // 逐欄位驗證與補預設，避免存檔被竄改或缺欄位造成錯誤
      return {
        version: SaveManager.CURRENT_VERSION,
        hiScore: this.safeNumber(parsed.hiScore, 0),
        maxStage: this.safeNumber(parsed.maxStage, 1),
      };
    } catch (err) {
      console.warn('[SaveManager] 讀取存檔失敗，改用預設值。', err);
      return SaveManager.defaultData();
    }
  }

  /**
   * 寫入存檔。
   * @param data 要儲存的資料
   */
  public save(data: SaveData): void {
    try {
      const toSave: SaveData = {
        version: SaveManager.CURRENT_VERSION,
        hiScore: this.safeNumber(data.hiScore, 0),
        maxStage: this.safeNumber(data.maxStage, 1),
      };
      localStorage.setItem(SaveManager.STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      // 寫入失敗（如空間已滿或無痕模式）僅警告，不影響遊戲進行
      console.warn('[SaveManager] 寫入存檔失敗。', err);
    }
  }

  /** 清除存檔（重置紀錄用）。 */
  public clear(): void {
    try {
      localStorage.removeItem(SaveManager.STORAGE_KEY);
    } catch (err) {
      console.warn('[SaveManager] 清除存檔失敗。', err);
    }
  }

  /** 確保取得有效數字，否則回傳預設值。 */
  private safeNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }
}
