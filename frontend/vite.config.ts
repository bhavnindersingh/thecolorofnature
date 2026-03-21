import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/odoo-image': {
        target: 'http://colnature.synology.me:8069/web/image',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/odoo-image/, ''),
      },
    },
  },
})
