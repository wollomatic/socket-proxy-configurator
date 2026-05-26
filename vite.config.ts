import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import packageJson from './package.json';

const productionCsp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  'upgrade-insecure-requests'
].join('; ');

const productionHeaderCsp = [
  productionCsp,
  "frame-ancestors 'none'"
].join('; ');

function productionSecurityMeta(): Plugin {
  return {
    name: 'production-security-meta',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: [
          '/*',
          `  Content-Security-Policy: ${productionHeaderCsp}`,
          '  X-Content-Type-Options: nosniff',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), clipboard-read=(self), clipboard-write=(self)'
        ].join('\n')
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: productionCsp
            },
            injectTo: 'head'
          },
          {
            tag: 'meta',
            attrs: {
              name: 'referrer',
              content: 'strict-origin-when-cross-origin'
            },
            injectTo: 'head'
          }
        ];
      }
    }
  };
}

export default defineConfig({
  plugins: [svelte(), productionSecurityMeta()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  build: {
    target: 'es2022',
    modulePreload: { polyfill: false }
  }
});
