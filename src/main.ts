/**
 * main.ts
 * ------------------------------------------------------------
 * 應用程式進入點。職責很單純：
 *   1. 取得畫面容器 DOM。
 *   2. 建立 GameManager 並啟動遊戲。
 *
 * 所有實際邏輯都在各個 Manager 裡，這裡只做「點火」。
 * ------------------------------------------------------------
 */

import { GameManager } from './core/GameManager';

// 取得放置 WebGL canvas 的容器
const container = document.getElementById('canvas-container');

if (!container) {
  // 若 HTML 結構缺少容器，直接報錯，避免無聲失敗
  throw new Error('[main] 找不到 #canvas-container，請檢查 index.html。');
}

// 建立遊戲主控並啟動
const game = new GameManager(container);
game.start();

// 將實例掛到 window 上，方便在瀏覽器 console 中除錯（開發期用）
// @ts-expect-error 開發用全域除錯掛載
window.__GAME__ = game;
