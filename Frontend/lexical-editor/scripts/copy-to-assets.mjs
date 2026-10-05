import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
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

const bundleFile = resolve(__dirname, '../../src/features/notes/editorBundle.ts');
if (existsSync(bundleFile)) {
  const htmlContent = readFileSync(src, 'utf-8');
  const b64 = Buffer.from(htmlContent, 'utf-8').toString('base64');
  const bundleContent = `const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function decodeBase64ToUtf8(b64: string): string {
  let str = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  let bytes: number[] = [];
  for (let i = 0; i < str.length; i += 4) {
    const enc1 = B64_CHARS.indexOf(str.charAt(i));
    const enc2 = B64_CHARS.indexOf(str.charAt(i + 1));
    const enc3 = B64_CHARS.indexOf(str.charAt(i + 2));
    const enc4 = B64_CHARS.indexOf(str.charAt(i + 3));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes.push(chr1);
    if (enc3 !== 64 && enc3 !== -1) bytes.push(chr2);
    if (enc4 !== 64 && enc4 !== -1) bytes.push(chr3);
  }

  const u8 = new Uint8Array(bytes);
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(u8);
  }
  let out = '';
  let i = 0;
  while (i < u8.length) {
    const c = u8[i++];
    if (c < 128) {
      out += String.fromCharCode(c);
    } else if (c > 191 && c < 224) {
      const c2 = u8[i++];
      out += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
    } else if (c > 223 && c < 240) {
      const c2 = u8[i++];
      const c3 = u8[i++];
      out += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
    } else {
      const c2 = u8[i++];
      const c3 = u8[i++];
      const c4 = u8[i++];
      let codepoint = (((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) - 0x10000;
      out += String.fromCharCode(0xd800 + (codepoint >> 10), 0xdc00 + (codepoint & 0x3ff));
    }
  }
  return out;
}

export const EDITOR_HTML_BASE64 = "${b64}";
export const EDITOR_HTML = decodeBase64ToUtf8(EDITOR_HTML_BASE64);
`;
  writeFileSync(bundleFile, bundleContent, 'utf-8');
  console.log(`✅ editorBundle.ts updated → ${bundleFile}`);
}
