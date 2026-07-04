import { defineConfig } from 'vite';

// Vite 設定檔
// base: './' 讓打包後的資源路徑為相對路徑，方便部署到 GitHub Pages 等子路徑環境
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true, // 執行 npm run dev 時自動開啟瀏覽器
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // 產生 sourcemap，方便除錯
    // Three.js 本身體積較大，提高警告門檻避免無意義的 chunk size 警告
    chunkSizeWarningLimit: 1500,
  },
});
