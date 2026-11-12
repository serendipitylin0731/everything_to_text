import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const target = 'public/ocr';
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp('node_modules/tesseract.js/dist/worker.min.js', `${target}/worker.min.js`);
for (const type of ['', '-simd', '-relaxedsimd']) {
  const name = `tesseract-core${type}-lstm.wasm.js`;
  await cp(`node_modules/tesseract.js-core/${name}`, `${target}/${name}`);
}
for (const lang of ['chi_sim', 'eng']) {
  const compressed = await readFile(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`);
  await writeFile(`${target}/${lang}.traineddata`, gunzipSync(compressed));
}

// PDF resources are local so importing PDF pages works offline.
await mkdir('public/pdf-resources', { recursive: true });
await cp('node_modules/pdfjs-dist/cmaps', 'public/pdf-resources/cmaps', { recursive: true });
await cp('node_modules/pdfjs-dist/standard_fonts', 'public/pdf-resources/standard_fonts', { recursive: true });
