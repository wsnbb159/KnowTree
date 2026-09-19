import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // 相对路径：保证构建产物可部署到任意子路径的静态托管
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 本机环境的删除垫片会拦截 vite 的目录清空（trash 进程超时）。
    // 构建前如需清理 dist，用 mv 归档代替删除。
    emptyOutDir: false,
  },
});
