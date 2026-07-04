/**
 * MathUtils.ts
 * ------------------------------------------------------------
 * 共用數學/隨機工具函式。集中放置，避免各處重複實作。
 * ------------------------------------------------------------
 */

/** 回傳 [min, max) 區間內的隨機浮點數 */
export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 回傳 [min, max] 區間內的隨機整數（含兩端） */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** 從陣列中隨機取一個元素 */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 隨機回傳 +1 或 -1（常用於決定左右側） */
export function randSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

/** 將數值限制在 [min, max] 範圍內 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 線性插值：t=0 回傳 a，t=1 回傳 b */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 計算點 P 到線段 AB 的最短距離平方。
 * 用於彈藥的「掃掠碰撞」：把彈藥這一幀的移動視為線段 A→B，
 * 檢查敵人中心到此線段的距離，即使彈藥速度很快也不會穿過敵人。
 * 回傳平方值以省去開根號（比較時用半徑平方即可）。
 */
export function distancePointToSegmentSq(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number
): number {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  // 線段退化成一點時，直接回傳點到點距離
  let t = abLenSq > 0 ? (apx * abx + apy * aby + apz * abz) / abLenSq : 0;
  t = Math.max(0, Math.min(1, t)); // 夾在線段範圍內
  const cx = ax + abx * t, cy = ay + aby * t, cz = az + abz * t;
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  return dx * dx + dy * dy + dz * dz;
}
