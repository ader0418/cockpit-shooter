/**
 * ObjectPool.ts
 * ------------------------------------------------------------
 * 通用物件池。射擊遊戲每秒會產生大量子彈與爆炸，若不斷 new 物件，
 * 會頻繁觸發垃圾回收（GC）造成畫面卡頓。物件池的作法是：
 *   - 用不到的物件不刪除，而是「收回」放進池子。
 *   - 需要新物件時，優先從池子拿舊的來重用。
 * 如此一來物件總數趨於穩定，避免 GC 尖峰，維持穩定幀率。
 * ------------------------------------------------------------
 */

export class ObjectPool<T> {
  /** 目前閒置、可重用的物件 */
  private freeList: T[] = [];
  /** 建立新物件的工廠函式（池子空了才會呼叫） */
  private readonly factory: () => T;

  /**
   * @param factory     建立新物件的函式
   * @param initialSize 預先建立的物件數量（預熱，避免遊戲中才臨時建立）
   */
  constructor(factory: () => T, initialSize = 0) {
    this.factory = factory;
    for (let i = 0; i < initialSize; i++) {
      this.freeList.push(this.factory());
    }
  }

  /** 取出一個物件：優先重用池中的，沒有才新建 */
  public acquire(): T {
    return this.freeList.pop() ?? this.factory();
  }

  /** 歸還一個物件到池中，供之後重用 */
  public release(item: T): void {
    this.freeList.push(item);
  }

  /** 目前池中閒置物件數量（除錯用） */
  public get freeCount(): number {
    return this.freeList.length;
  }
}
