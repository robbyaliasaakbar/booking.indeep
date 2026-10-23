import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Config dev + build frontend App InDeep Booking (PRD Bab 14.4)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Base SELALU absolut (PRD Bab 14.5): '/' untuk dev, build lokal, & produksi
  // (subdomain booking.indeepcleaningid.site).
  // Base relatif './' sengaja ditinggalkan: bikin asset 404 saat hard-refresh
  // di route dalam (mis. /admin-bookings/51/struk) dan bikin BASE_URL gak jelas.
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    // Build frontend langsung jatuh ke public/ — Hostinger gak jalan npm,
    // jadi hasil build WAJIB ke-commit & ke-deploy bareng backend (Batch A deploy).
    // outDir di-resolve relatif terhadap root project (web/).
    outDir: '../public',
    // public/ isi api/, brand/, uploads/, .htaccess — jangan dikosongin!
    emptyOutDir: false,
    // Pisahkan vendor framework ke chunk sendiri (issue #15): react/react-dom/
    // react-router jarang berubah, jadi cache-nya bisa tahan lintas deploy
    // sementara chunk halaman (lazy) tetap kecil & ber-hash per route.
    // CATATAN: Vite 8 pakai Rolldown → manualChunks WAJIB fungsi, object ditolak.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor'
          }
        },
      },
    },
  },
  server: {
    // strictPort mati: bila 5173 penuh, Vite auto geser ke 5174/5175 (PRD Bab 14.4)
    strictPort: false,
    // Proxy /api ke backend PHP supaya dev tidak kena CORS (PRD Bab 14.4)
    // Port 5011 = keputusan Bang Rob (port 8000 dipakai app lain)
    proxy: {
      '/api': {
        target: 'http://localhost:5011',
        changeOrigin: false,
      },
      // Foto profil diupload ke public/uploads backend — tanpa proxy ini,
      // /uploads/*.webp kena SPA fallback (balik index.html) dan foto gak muncul
      '/uploads': {
        target: 'http://localhost:5011',
        changeOrigin: false,
      },
    },
  },
})
