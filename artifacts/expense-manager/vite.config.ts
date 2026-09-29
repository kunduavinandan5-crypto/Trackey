import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || '/';

// Absolute-URL SEO tags (canonical, og:url, og:image) and sitemap/robots need
// the public origin, e.g. VITE_SITE_URL=https://spendly.example.com
function seo(siteUrl: string | undefined): Plugin {
  const origin = siteUrl?.trim().replace(/\/+$/, '');
  let outDir = 'dist';
  return {
    name: 'spendly-seo',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    transformIndexHtml() {
      if (!origin) return [];
      const meta = (attrs: Record<string, string>) => ({ tag: 'meta', attrs, injectTo: 'head' as const });
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: `${origin}/` }, injectTo: 'head' },
        meta({ property: 'og:url', content: `${origin}/` }),
        meta({ property: 'og:image', content: `${origin}/pwa-512x512.png` }),
        meta({ property: 'og:image:alt', content: 'Spendly logo' }),
        meta({ name: 'twitter:image', content: `${origin}/pwa-512x512.png` }),
      ];
    },
    writeBundle() {
      // Only the public entry page is indexable; everything else is behind login.
      const robots = ['User-agent: *', 'Allow: /$', 'Disallow: /expenses', 'Disallow: /add-expense', 'Disallow: /summary', 'Disallow: /settings', 'Allow: /'];
      if (origin) {
        robots.push('', `Sitemap: ${origin}/sitemap.xml`);
        const today = new Date().toISOString().slice(0, 10);
        fs.writeFileSync(
          path.join(outDir, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n</urlset>\n`,
        );
      }
      fs.writeFileSync(path.join(outDir, 'robots.txt'), robots.join('\n') + '\n');
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = process.env.VITE_SITE_URL || env.VITE_SITE_URL;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://ytnrtpaavuvrufbjqgfe.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bnJ0cGFhdnV2cnVmYmpxZ2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzg4NzAsImV4cCI6MjEwNDQ1NDg3MH0.NpevKARacYjbS-KndRWr9MHParKp8TDinwdgtzFJarM';

  return {
    base: basePath,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  plugins: [
    react(),
    tailwindcss(),
    seo(siteUrl),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
      ],
      manifest: {
        name: 'Spendly — Personal Expense Manager',
        short_name: 'Spendly',
        description: 'A private, mindful personal finance and expense tracker built for everyday awareness.',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        categories: ['finance', 'productivity', 'utilities'],
        shortcuts: [
          {
            name: 'Add Expense',
            short_name: 'Add',
            description: 'Quickly record an expense',
            url: '/add-expense',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Summary',
            short_name: 'Summary',
            description: 'View monthly spending breakdown',
            url: '/summary',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port,
    host: '0.0.0.0',
  },
  preview: {
    port,
    host: '0.0.0.0',
  },
};
});
