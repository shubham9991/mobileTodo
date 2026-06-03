/**
 * Post-build script: copies dist/index.html → android/app/src/main/assets/editor.html
 * Run via: npm run build:rn
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../dist/index.html');
const destDir = resolve(__dirname, '../../android/app/src/main/assets');
const dest = resolve(destDir, 'editor.html');

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

copyFileSync(src, dest);
console.log(`✅ editor.html copied → ${dest}`);
