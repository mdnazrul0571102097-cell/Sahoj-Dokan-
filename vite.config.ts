import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import * as esbuild from 'esbuild';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function unwrapCssLayers(input: string): string {
  let s = input.replace(/@layer\s+[^{;]+;/g, '');
  while (/@layer\s+[^{]+\{/.test(s)) {
    const match = s.match(/@layer\s+[^{]+\{/);
    if (!match || match.index === undefined) break;
    const startIdx = match.index;
    const openBraceIdx = startIdx + match[0].length - 1;
    let depth = 1;
    let i = openBraceIdx + 1;
    while (i < s.length && depth > 0) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') depth--;
      i++;
    }
    if (depth === 0) {
      const inner = s.slice(openBraceIdx + 1, i - 1);
      s = s.slice(0, startIdx) + inner + s.slice(i);
    } else {
      break;
    }
  }
  return s;
}

function universalAndroidWebviewPlugin(): Plugin {
  return {
    name: 'universal-android-webview',
    apply: 'build',
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, 'dist');
        const distAssetsDir = path.join(distDir, 'assets');
        const jsPath = path.join(distAssetsDir, 'index.js');
        const cssPath = path.join(distAssetsDir, 'index.css');
        const htmlPath = path.join(distDir, 'index.html');

        // 1. Convert JS bundle to self-contained IIFE targeting Chrome 68 (no ES2022 #private or ?./?? syntax errors)
        if (fs.existsSync(jsPath)) {
          const iifeRes = esbuild.buildSync({
            entryPoints: [jsPath],
            bundle: true,
            format: 'iife',
            target: ['chrome68'],
            minify: true,
            write: false,
          });
          if (iifeRes.outputFiles && iifeRes.outputFiles[0]) {
            fs.writeFileSync(jsPath, iifeRes.outputFiles[0].text, 'utf8');
          }
        }

        // 2. Downlevel CSS oklch() via lightningcss and unwrap @layer blocks for Android WebView compatibility
        if (fs.existsSync(cssPath)) {
          const lcss = require('lightningcss');
          const rawCss = fs.readFileSync(cssPath);
          const transformed = lcss.transform({
            filename: 'index.css',
            code: rawCss,
            minify: false,
            targets: { chrome: 60 << 16, android: 60 << 16 },
          });
          const flatCss = unwrapCssLayers(transformed.code.toString());
          const minCss = esbuild.transformSync(flatCss, {
            loader: 'css',
            minify: true,
            target: ['chrome60'],
          });
          fs.writeFileSync(cssPath, minCss.code, 'utf8');
        }

        // 3. Rewrite dist/index.html to use standard classic <script defer src="./assets/index.js">
        if (fs.existsSync(htmlPath)) {
          let html = fs.readFileSync(htmlPath, 'utf8');
          html = html.replace(
            /<script\s+type="module"\s+crossorigin\s+src="[^"]+"><\/script>/g,
            '<script defer src="./assets/index.js"></script>'
          );
          html = html.replace(
            /<link\s+rel="stylesheet"\s+crossorigin\s+href="[^"]+">/g,
            '<link rel="stylesheet" href="./assets/index.css">'
          );
          fs.writeFileSync(htmlPath, html, 'utf8');
        }

        // 4. Sync directly to android/app/src/main/assets/public/
        const androidPublicDir = path.resolve(__dirname, 'android/app/src/main/assets/public');
        const androidAssetsDir = path.join(androidPublicDir, 'assets');
        if (fs.existsSync(androidPublicDir)) {
          fs.mkdirSync(androidAssetsDir, { recursive: true });
          if (fs.existsSync(htmlPath)) {
            fs.copyFileSync(htmlPath, path.join(androidPublicDir, 'index.html'));
          }
          if (fs.existsSync(jsPath)) {
            fs.copyFileSync(jsPath, path.join(androidAssetsDir, 'index.js'));
            // Also keep fallback copies for any cached legacy hash references
            fs.copyFileSync(jsPath, path.join(androidAssetsDir, 'index-C5jJ5sAh.js'));
            fs.copyFileSync(jsPath, path.join(androidAssetsDir, 'index-C-dBsnY4.js'));
          }
          if (fs.existsSync(cssPath)) {
            fs.copyFileSync(cssPath, path.join(androidAssetsDir, 'index.css'));
            fs.copyFileSync(cssPath, path.join(androidAssetsDir, 'index-DE9H_Bm-.css'));
          }
        }
      } catch (err) {
        console.error('universalAndroidWebviewPlugin error:', err);
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    universalAndroidWebviewPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false,
    watch: null,
  },
  build: {
    target: 'es2019',
    cssTarget: 'chrome80',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
