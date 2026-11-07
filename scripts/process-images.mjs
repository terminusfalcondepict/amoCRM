// Переводит экспорты из Figma (design-src/) в WebP (public/img/).
// Экспорт 2x приходит с запечённым фоном макета, поэтому, если есть снимок 1x с прозрачностью
// (design-src/alpha/), берём из него маску и убираем подмешанный фон из полупрозрачных пикселей.
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SRC = 'design-src';
const OUT = 'public/img';
const BG = [237, 238, 241];
// Области в пикселях экспорта (2x): карточки содержат текст, берём только иллюстрацию.
const crops = {
  card1: { left: 0, top: 356, width: 670, height: 484 },
  card2: { left: 0, top: 312, width: 670, height: 528 },
  card3: { left: 0, top: 312, width: 670, height: 528 },
  card4: { left: 0, top: 312, width: 670, height: 528 },
  service1: { left: 0, top: 0, width: 880, height: 543 },
  steps: { left: 0, top: 580, width: 960, height: 914 },
};

async function load(name) {
  const file = `${SRC}/${name}.png`;
  const alphaFile = `${SRC}/alpha/${name}.png`;
  if (!existsSync(alphaFile)) return sharp(file);
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alpha = await sharp(alphaFile).ensureAlpha().extractChannel('alpha')
    .resize(width, height, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer();
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const a = alpha[i] / 255;
    for (let c = 0; c < 3; c++) {
      const v = data[i * 3 + c];
      out[i * 4 + c] = a > 0.02 ? Math.max(0, Math.min(255, Math.round((v - (1 - a) * BG[c]) / a))) : 0;
    }
    out[i * 4 + 3] = a <= 0.02 ? 0 : alpha[i];
  }
  return sharp(out, { raw: { width, height, channels: 4 } });
}

const names = (await readdir(SRC)).filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', ''));
for (const name of names) {
  let img = await load(name);
  if (crops[name]) {
    const buf = await img.png().toBuffer();
    img = sharp(buf).extract(crops[name]);
  }
  if (name === 'w-key' || name === 'w-cursor') img = sharp(await img.png().toBuffer()).resize({ height: 320 });
  await img.webp({ quality: 86, alphaQuality: 95, effort: 6 }).toFile(`${OUT}/${name}.webp`);
}
console.log('готово:', names.length);
