import { cp, mkdir } from 'node:fs/promises';
const target = 'public/ocr';
await mkdir(target, { recursive: true });
await cp('node_modules/tesseract.js/dist/worker.min.js', `${target}/worker.min.js`);
for (const type of ['', '-simd', '-relaxedsimd']) {
  const name = `tesseract-core${type}-lstm.wasm.js`;
  await cp(`node_modules/tesseract.js-core/${name}`, `${target}/${name}`);
}
for (const lang of ['chi_sim', 'eng']) await cp(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `${target}/${lang}.traineddata.gz`);
