// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.

import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o site funciona tanto em localhost quanto no GitHub Pages
  // (que serve o site dentro de uma subpasta com o nome do repositório).
  base: './',
  server: {
    proxy: {
      // Em desenvolvimento, tudo que começa com /api vai para o FastAPI (porta 8000).
      // Ex.: o front chama /api/health e o Vite repassa para http://localhost:8000/health.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
