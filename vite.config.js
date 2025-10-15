import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,          // 🔄 5173 → 5174
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      clientPort: 5174,  // 🔄 동일 포트
      overlay: false,    // (선택) HMR 오버레이 비활성화
    },
  },
  resolve: {
    alias: {
      // React 단일 사본 고정 (훅 에러 예방)
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
    },
  },
  optimizeDeps: {
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
})
