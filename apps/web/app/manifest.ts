import type { MetadataRoute } from 'next';

// PWA manifest (Next metadata route → /manifest.webmanifest). Makes Nhonga
// installable ("Adicionar à tela inicial") and launchable full-screen — a big
// win for low-end Android where an app-like shortcut beats a browser tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nhonga — Compre e venda em Moçambique',
    short_name: 'Nhonga',
    description: 'O mercado online de Moçambique. Compre e venda perto de si.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'pt',
    dir: 'ltr',
    background_color: '#0A6B50',
    theme_color: '#0A6B50',
    categories: ['shopping', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
