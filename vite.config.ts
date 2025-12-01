import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const threeRoot = path.resolve(__dirname, 'vendor/threejs');
const threeExamplesPath = path.resolve(__dirname, 'vendor/threejs/examples/jsm');

function ensureHttpsConfig() {
  const certDir = path.resolve(process.cwd(), '.cert');
  const keyPath = path.join(certDir, 'localhost-key.pem');
  const certPath = path.join(certDir, 'localhost-cert.pem');
  const haveFiles = fs.existsSync(keyPath) && fs.existsSync(certPath);

  if (!haveFiles) {
    try {
      fs.mkdirSync(certDir, { recursive: true });
      execSync(
        `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -subj "/CN=localhost" -days 3650`,
        { stdio: 'ignore' },
      );
      console.log(`Generated self-signed dev certificate in ${certDir}`);
    } catch (err) {
      console.warn('HTTPS dev cert generation failed; falling back to HTTP.', err);
      return undefined;
    }
  }

  try {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  } catch (err) {
    console.warn('HTTPS dev cert read failed; falling back to HTTP.', err);
    return undefined;
  }
}

const httpsConfig = ensureHttpsConfig();
const httpOnly = process.env.VITE_HTTP_ONLY === '1' || process.env.HTTP_ONLY === '1';

export default defineConfig({
  resolve: {
    alias: [
      // Map the new `three/addons/*` paths to our vendored examples folder.
      { find: /^three\/addons/, replacement: threeExamplesPath },
      { find: /^three\/examples\/jsm/, replacement: threeExamplesPath },
      // Point core `three` imports at the vendored package root (not the file),
      // so subpaths like `examples/jsm` resolve correctly.
      { find: 'three', replacement: threeRoot },
    ],
  },
  server: {
    host: true,
    port: 5173,
    https: httpOnly ? false : httpsConfig || false,
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
