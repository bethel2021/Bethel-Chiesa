import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig, loadEnv} from 'vite';
import {buildHeadPrefetchScript} from './src/lib/headPrefetchScript.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveClientFirebaseEndpoints(mode: string) {
  const env = loadEnv(mode, __dirname, '');
  let fileCfg: {
    apiKey?: string;
    projectId?: string;
    firestoreDatabaseId?: string;
  } = {};

  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    } catch {
      // Ignore malformed config
    }
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY || fileCfg.apiKey || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || fileCfg.projectId || '',
    databaseId:
      env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || fileCfg.firestoreDatabaseId || '(default)',
  };
}

export default defineConfig(({mode}) => {
  const firebaseEndpoints = resolveClientFirebaseEndpoints(mode);

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'inject-head-hero-prefetch',
        transformIndexHtml(html) {
          const scriptTag = buildHeadPrefetchScript(firebaseEndpoints);
          if (!scriptTag) return html;
          return html.replace('</head>', `    ${scriptTag}\n  </head>`);
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-firebase',
                test: /node_modules[\\/]firebase/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
