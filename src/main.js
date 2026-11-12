import './style.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
import { formatRecognized } from './ocr-format.js';
import { createWorker } from 'tesseract.js';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getAll, getRecord, putRecord, deleteRecord, clearRecords, migrateOldHistory } from './storage.js';
import { makeFile } from './export.js';

const $ = s => document.querySelector(s);
$('#app').innerHTML = `
<main id="scrollArea">
<section id="homePage" class="page"><div class="hero"><div class="eyebrow">YOUR WORDS, KEPT CLOSE</div><h1>看见文字，<br><em>留住灵感。</em></h1><p>拍下眼前的文字，整理成你想要的样子。</p><div class="hero-art" aria-hidden="true">字<span>✳</span></div></div><div class="home-card"><div><h2>开始拾取文字</h2><p>支持多张图片、PDF 和自由框选</p></div><button class="button light" id="startBtn">开始识别 →</button></div><h2 class="block-title">简单三步，整理好文字</h2><div class="steps"><div><b>01</b><span>添加图片<small>拍照，或批量选择图片与 PDF</small></span></div><div><b>02</b><span>框选与整理<small>选择区域，编辑文字格式</small></span></div><div><b>03</b><span>导出与分享<small>保存或转发你的文档</small></span></div></div></section>
<section id="recognizePage" class="page" hidden><div class="page-head"><span>CAPTURE & EDIT</span><h1>识别文字</h1><p>从图片中选择需要的内容，再整理成文档。</p></div><div class="flow-tabs"><button data-stage="select" class="active"><i>1</i> 添加与框选</button><button data-stage="edit"><i>2</i> 文字整理</button><button data-stage="export"><i>3</i> 导出分享</button></div>
<div id="selectStage"><div class="card section-card"><div class="row-title"><div><h2>添加图片</h2><p>支持批量选择图片或 PDF，按顺序拼接识别结果</p></div><span id="imageCount" class="muted"></span></div><div class="upload-actions"><button class="button primary" id="cameraBtn">◎ 拍照</button><button class="button outline" id="galleryBtn">＋ 导入图片</button><button class="button outline" id="pdfBtn">＋ 导入 PDF</button></div><input id="cameraInput" type="file" accept="image/*" capture="environment" hidden><input id="galleryInput" type="file" accept="image/*" multiple hidden><input id="pdfInput" type="file" accept="application/pdf,.pdf" multiple hidden><div id="imageStrip" class="image-strip"></div></div>
<div id="selectionCard" class="card section-card" hidden><div class="row-title"><div><h2>选择识别区域</h2><p id="selectionHint">按住并拖动，框出需要识别的文字</p></div><span id="selectionIndex" class="muted"></span></div><div class="selection-modes" role="group" aria-label="选区方式"><button type="button" data-selection-mode="rectangle" class="active" aria-pressed="true">▭ 矩形框选</button><button type="button" data-selection-mode="freehand" aria-pressed="false">✎ 自由选择</button></div><div class="canvas-wrap"><canvas id="selectionCanvas" aria-label="在图片上选择识别区域"></canvas></div><div class="selection-actions"><button id="previousImage" class="text-button">← 上一张</button><button id="resetSelection" class="text-button">重置选区</button><button id="nextImage" class="text-button">下一张 →</button></div><p id="selectionStatus" class="tip"></p></div><div class="progress card" id="progress" hidden><div><span id="progressText">正在准备识别…</span><span id="progressPercent"></span></div><div class="progress-track"><div id="progressBar"></div></div></div><button class="button primary wide" id="recognizeBtn" disabled>完成选择，开始识别 →</button><button class="button ghost wide" id="skipToEdit">直接整理文字</button></div>
<div id="editStage" hidden><div class="card editor-card"><div class="editor-top"><span>✎ &nbsp; 文字整理</span><span id="count">0 字</span></div><input id="title" maxlength="80" placeholder="给文档起个名字" value="未命名文档" aria-label="文档标题"><div class="toolbar" role="toolbar" aria-label="文字格式"><select id="fontSize" aria-label="字号"><option value="">字号</option><option value="2">小</option><option value="3">标准</option><option value="4">中</option><option value="5">大</option><option value="6">特大</option></select><button data-command="bold" title="加粗"><b>B</b></button><button data-command="italic" title="斜体"><i>I</i></button><button data-command="underline" title="下划线"><u>U</u></button><button data-command="insertUnorderedList" title="无序列表">• 列表</button><button data-command="insertOrderedList" title="有序列表">1. 列表</button><button id="tableBtn" title="插入表格">▦ 表格</button><button id="mathBtn" title="插入数学公式">∑ 公式</button><button data-command="removeFormat" title="清除格式">清格式</button></div><div id="content" class="rich-content" contenteditable="true" role="textbox" aria-multiline="true" aria-label="文档内容" data-placeholder="识别后的文字会出现在这里，也可以直接输入或粘贴文字。"></div><div class="editor-bottom"><span>编辑会自动保存到历史记录</span><button class="text-button" id="clearContent">清空文字</button></div></div><div class="stage-actions"><button class="button outline" data-go="select">← 管理图片</button><button class="button primary" data-go="export">下一步：导出 →</button></div></div>
<div id="exportStage" hidden><div class="card section-card"><div class="row-title"><div><h2>选择输出格式</h2><p>整理完成后，保存或直接分享给朋友</p></div></div><div class="formats"><label><input type="radio" name="format" value="md" checked><span>MD<small>Markdown</small></span></label><label><input type="radio" name="format" value="docx"><span>DOCX<small>Word 文档</small></span></label><label><input type="radio" name="format" value="pdf"><span>PDF<small>便携文档</small></span></label></div><p class="tip">Markdown 支持粗体、列表和表格，但不支持字号；PDF 使用图片页面。</p><div class="export-buttons"><button class="button outline" id="saveBtn">↓ 保存文件</button><button class="button primary" id="shareBtn">↗ 导出并分享</button></div></div><button class="button ghost wide" data-go="edit">← 返回整理</button></div></section>
<section id="historyPage" class="page" hidden><div class="page-head"><span>YOUR COLLECTION</span><h1>我的历史</h1><p>打开记录，可继续编辑图片和文字。</p></div><div class="history-head"><div><h2>文字记录</h2><span id="historyCount">0 / 100</span></div><button id="clearHistory" class="text-button">清空历史</button></div><div id="historyList"></div></section></main>
<nav class="bottom-nav" aria-label="主导航"><button class="nav-item active" data-page="home" aria-current="page"><span>⌂</span>首页</button><button class="nav-item" data-page="recognize"><span>▣</span>识别</button><button class="nav-item" data-page="history"><span>◷</span>我的历史</button></nav><div id="toast" role="status" aria-live="polite"></div><div id="mathDialog" class="dialog-backdrop" hidden><div class="math-dialog" role="dialog" aria-modal="true" aria-labelledby="mathDialogTitle"><h2 id="mathDialogTitle">数学公式</h2><p>使用 LaTeX 输入，支持分数、上下标和根号等。</p><label for="mathInput">公式内容</label><textarea id="mathInput" rows="3" placeholder="例如：\\frac{a}{b} 或 E=mc^2"></textarea><span class="math-label">实时预览</span><div id="mathPreview" class="math-preview"></div><div id="mathError" class="math-error" aria-live="polite"></div><div class="dialog-actions"><button id="mathCancel" class="button outline">取消</button><button id="mathSave" class="button primary">插入公式</button></div></div></div>`;

const content = $('#content'), title = $('#title');
let images = [], imageIndex = 0, currentId = null, worker = null, busy = false, currentImage = null, drawing = null, selectionMode = 'rectangle', saveTimer = null, saveQueue = Promise.resolve(), loadingHistory = false;
let migration = migrateOldHistory().catch(err => { console.error(err); toast('旧历史记录迁移失败，请检查设备存储'); });
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3500); }
function showPage(page) {
  if (busy) { toast('请等待当前识别完成'); return; }
  if (page === 'history') { flushSave().then(renderHistory).catch(reportStorage); }
  for (const name of ['home', 'recognize', 'history']) $(`#${name}Page`).hidden = name !== page;
  document.querySelectorAll('.nav-item').forEach(button => { const active = button.dataset.page === page; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  $('#scrollArea').scrollTop = 0;
}
function showStage(stage) {
  if (busy) { toast('请等待当前识别完成'); return; }
  for (const name of ['select', 'edit', 'export']) $(`#${name}Stage`).hidden = name !== stage;
  document.querySelectorAll('[data-stage]').forEach(button => button.classList.toggle('active', button.dataset.stage === stage));
  $('#scrollArea').scrollTop = 0;
}
document.querySelectorAll('[data-page]').forEach(button => button.onclick = () => showPage(button.dataset.page));
document.querySelectorAll('[data-stage]').forEach(button => button.onclick = () => showStage(button.dataset.stage));
document.querySelectorAll('[data-go]').forEach(button => button.onclick = () => showStage(button.dataset.go));
$('#startBtn').onclick = async () => { if (busy) return; try { await flushSave(); currentId = null; images = []; imageIndex = 0; content.innerHTML = ''; title.value = '未命名文档'; updateCount(); renderImages(); showPage('recognize'); showStage('select'); } catch (error) { reportStorage(error); } };
$('#skipToEdit').onclick = () => showStage('edit');
function reportStorage(error) { console.error(error); toast('保存失败，请检查设备存储空间'); }
function hasContent() { return !!content.textContent.trim() || images.length > 0; }
function snapshot() {
  if (!hasContent() && !currentId) return null;
  if (!currentId) currentId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id: currentId, title: title.value.trim() || '未命名文档', html: content.innerHTML, images: images.map(({ blob, name, points, selectionType, recognized }) => ({ blob, name, points, selectionType, recognized })), updatedAt: Date.now() };
}
function enqueueSave() {
  const record = snapshot(); if (!record) return saveQueue;
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await migration; await putRecord(record);
    const all = (await getAll()).sort((a, b) => b.updatedAt - a.updatedAt);
    for (const entry of all.slice(100)) await deleteRecord(entry.id);
  });
  saveQueue.catch(reportStorage); return saveQueue;
}
function scheduleSave() { if (loadingHistory) return; clearTimeout(saveTimer); saveTimer = setTimeout(enqueueSave, 450); }
function flushSave() { clearTimeout(saveTimer); return enqueueSave(); }
function updateCount() { $('#count').textContent = `${Array.from(content.innerText || content.textContent).length} 字`; }
content.addEventListener('input', () => { updateCount(); scheduleSave(); }); title.addEventListener('input', scheduleSave);
window.addEventListener('pagehide', () => { flushSave().catch(() => {}); });
$('#clearContent').onclick = () => { if (content.textContent.trim() && !confirm('确定清空当前文字吗？')) return; content.innerHTML = ''; updateCount(); scheduleSave(); };
async function renderHistory() {
  await migration; const records = (await getAll()).sort((a,b) => b.updatedAt - a.updatedAt); const list = $('#historyList'); list.replaceChildren();
  $('#historyCount').textContent = `${records.length} / 100`; $('#clearHistory').disabled = !records.length;
  if (!records.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.innerHTML = '<div>◷</div><strong>还没有文字记录</strong><p>添加的图片和文字会自动保存在这里。</p>'; list.append(empty); return; }
  for (const record of records) {
    const item = document.createElement('article'); item.className = 'history-item';
    const open = document.createElement('button'); open.className = 'history-open'; const text = document.createElement('div'); if (record.images?.[0]?.blob) { const thumb = document.createElement('img'); const url = URL.createObjectURL(record.images[0].blob); thumb.src = url; thumb.alt = ''; thumb.onload = thumb.onerror = () => URL.revokeObjectURL(url); open.append(thumb); } else { const placeholder = document.createElement('span'); placeholder.className = 'history-placeholder'; placeholder.setAttribute('aria-hidden', 'true'); placeholder.textContent = '文'; open.append(placeholder); }
    const name = document.createElement('strong'); name.textContent = record.title || '未命名文档';
    const preview = document.createElement('p'); const div = document.createElement('div'); div.innerHTML = record.html || ''; preview.textContent = div.textContent || '暂无文字';
    const meta = document.createElement('small'); meta.textContent = `${new Date(record.updatedAt).toLocaleDateString('zh-CN')} · ${record.images?.length || 0} 张图片`;
    text.append(name, preview, meta); open.append(text); open.onclick = () => openHistory(record.id);
    const del = document.createElement('button'); del.className = 'history-delete'; del.textContent = '删除'; del.setAttribute('aria-label', `删除${record.title}`); del.onclick = () => removeHistory(record.id, record.title);
    item.append(open, del); list.append(item);
  }
}
async function openHistory(id) {
  try {
    await flushSave(); const record = await getRecord(id); if (!record) { toast('记录已不存在'); return; }
    loadingHistory = true; currentId = record.id; title.value = record.title || '未命名文档'; content.innerHTML = record.html || ''; images = record.images || []; imageIndex = 0; updateCount(); loadingHistory = false;
    renderImages(); showPage('recognize'); showStage('edit');
  } catch (error) { loadingHistory = false; reportStorage(error); }
}
async function removeHistory(id, name) {
  if (!confirm(`确定删除“${name || '未命名文档'}”吗？`)) return;
  try { clearTimeout(saveTimer); await saveQueue; await deleteRecord(id); if (currentId === id) { currentId = null; images = []; content.innerHTML = ''; title.value = '未命名文档'; updateCount(); renderImages(); } await renderHistory(); } catch (error) { reportStorage(error); }
}
$('#clearHistory').onclick = async () => {
  if (!confirm('确定清空所有历史记录吗？此操作无法撤销。')) return;
  try { clearTimeout(saveTimer); await saveQueue; await clearRecords(); currentId = null; images = []; content.innerHTML = ''; title.value = '未命名文档'; updateCount(); renderImages(); await renderHistory(); toast('历史记录已清空'); } catch (error) { reportStorage(error); }
};
$('#cameraBtn').onclick = () => { if (!busy) $('#cameraInput').click(); };
$('#galleryBtn').onclick = () => { if (!busy) $('#galleryInput').click(); };
$('#pdfBtn').onclick = () => { if (!busy) $('#pdfInput').click(); };
for (const input of [$('#cameraInput'), $('#galleryInput'), $('#pdfInput')]) input.onchange = async () => {
  const files = [...(input.files || [])]; input.value = '';
  if (!files.length || busy) return;
  busy = true; $('#progress').hidden = false; const firstIndex = images.length; let failed = 0;
  try {
    for (const file of files) {
      const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if ((input.id === 'pdfInput' && !pdf) || (input.id !== 'pdfInput' && (pdf || !file.type.startsWith('image/')))) { failed++; continue; }
      if (!pdf) { images.push({ blob: file, name: file.name || '照片', points: null, recognized: false }); continue; }
      let documentTask, doc;
      try {
        $('#progressText').textContent = `正在打开 ${file.name}`; $('#progressPercent').textContent = ''; $('#progressBar').style.width = '0%';
        const resources = new URL('pdf-resources/', document.baseURI).href;
        documentTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: `${resources}cmaps/`, cMapPacked: true, standardFontDataUrl: `${resources}standard_fonts/` });
        doc = await documentTask.promise;
        for (let number = 1; number <= doc.numPages; number++) {
          $('#progressText').textContent = `正在导入 ${file.name}：第 ${number} / ${doc.numPages} 页`;
          const pct = Math.round(number / doc.numPages * 100); $('#progressPercent').textContent = `${pct}%`; $('#progressBar').style.width = `${pct}%`;
          const page = await doc.getPage(number), base = page.getViewport({ scale: 1 });
          const scale = Math.min(2, 2500 / Math.max(base.width, base.height)), viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.ceil(viewport.width)); canvas.height = Math.max(1, Math.ceil(viewport.height));
          await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, background: '#fff' }).promise;
          const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PDF 页面转换失败')), 'image/png'));
          images.push({ blob, name: `${file.name} · 第 ${number} 页`, points: null, recognized: false }); page.cleanup(); canvas.width = canvas.height = 1;
        }
      } catch (error) { console.error(error); failed++; }
      finally { if (doc) await doc.destroy(); else if (documentTask) await documentTask.destroy(); }
    }
  } finally {
    busy = false; $('#progress').hidden = true;
    if (images.length > firstIndex) { imageIndex = firstIndex; renderImages(); scheduleSave(); }
    if (failed) toast(`${failed} 个文件无法导入，请检查文件或密码`);
  }
};
let drawVersion = 0;
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片无法读取')); };
    image.src = url;
  });
}
function renderImages() {
  const strip = $('#imageStrip'); strip.replaceChildren(); $('#imageCount').textContent = `${images.length} 张`;
  $('#selectionCard').hidden = !images.length; $('#recognizeBtn').disabled = busy || !images.length;
  if (imageIndex >= images.length) imageIndex = Math.max(0, images.length - 1);
  images.forEach((entry, index) => {
    const wrap = document.createElement('div'); wrap.className = 'thumb' + (index === imageIndex ? ' selected' : '');
    const pick = document.createElement('button'); pick.className = 'thumb-pick'; pick.setAttribute('aria-label', `选择第 ${index + 1} 张图片`);
    const img = document.createElement('img'); const url = URL.createObjectURL(entry.blob); img.src = url; img.onload = img.onerror = () => URL.revokeObjectURL(url); pick.append(img);
    const badge = document.createElement('span'); badge.textContent = `${index + 1}`; pick.append(badge); pick.onclick = () => { if (!busy) { imageIndex = index; renderImages(); } };
    const remove = document.createElement('button'); remove.className = 'thumb-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `删除第 ${index + 1} 张图片`);
    remove.onclick = () => { if (busy) { toast('请等待当前识别完成'); return; } if (!confirm('删除这张图片？已有文字会保留。')) return; images.splice(index, 1); if (index < imageIndex) imageIndex--; renderImages(); scheduleSave(); };
    wrap.append(pick, remove); strip.append(wrap);
  });
  if (!images.length) { drawVersion++; currentImage = null; return; }
  $('#selectionIndex').textContent = `${imageIndex + 1} / ${images.length}`;
  $('#previousImage').disabled = imageIndex === 0; $('#nextImage').disabled = imageIndex === images.length - 1;
  updateSelectionStatus();
  const version = ++drawVersion;
  loadImage(images[imageIndex].blob).then(img => { if (version !== drawVersion) return; currentImage = img; const canvas = $('#selectionCanvas'); const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight)); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale)); paintSelection(); }).catch(err => { console.error(err); toast('图片无法读取，请重新选择'); });
}
function paintSelection(points = images[imageIndex]?.points) {
  if (!currentImage || !images.length) return; const canvas = $('#selectionCanvas'), ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
  if (points?.length) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x * canvas.width, p.y * canvas.height) : ctx.moveTo(p.x * canvas.width, p.y * canvas.height));
    if ((!drawing || selectionMode === 'rectangle') && points.length >= 3) ctx.closePath(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, canvas.width / 250); ctx.stroke(); ctx.strokeStyle = '#27754b'; ctx.lineWidth = Math.max(1.5, canvas.width / 500); ctx.stroke();
    if ((!drawing || selectionMode === 'rectangle') && points.length >= 3) { ctx.fillStyle = 'rgba(71, 159, 97, .20)'; ctx.fill(); }
  }
}
const canvas = $('#selectionCanvas');
function pointerPoint(event) { const rect = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }; }
function updateSelectionStatus() {
  const image = images[imageIndex];
  $('#selectionStatus').textContent = image?.points?.length >= 3 ? `已选择${image.selectionType === 'rectangle' ? '矩形' : '自由'}区域，可重新选择或重置` : '未设置选区，将识别整张图片';
}
document.querySelectorAll('[data-selection-mode]').forEach(button => button.onclick = () => {
  if (busy) return;
  selectionMode = button.dataset.selectionMode;
  document.querySelectorAll('[data-selection-mode]').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
  $('#selectionHint').textContent = selectionMode === 'rectangle' ? '按住并拖动，框出需要识别的文字' : '按住并沿文字边缘自由绘制，松手后自动闭合';
});
function rectanglePoints(start, end) { return [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }]; }
canvas.addEventListener('pointerdown', event => { if (!currentImage || busy) return; event.preventDefault(); canvas.setPointerCapture(event.pointerId); drawing = [pointerPoint(event)]; paintSelection(drawing); });
canvas.addEventListener('pointermove', event => {
  if (!drawing) return; event.preventDefault(); const point = pointerPoint(event);
  if (selectionMode === 'rectangle') drawing = rectanglePoints(drawing[0], point);
  else { const prev = drawing[drawing.length - 1]; if (Math.hypot(point.x - prev.x, point.y - prev.y) > .003) drawing.push(point); }
  paintSelection(drawing);
});
function finishDrawing(event) {
  if (!drawing) return;
  if (event.type === 'pointercancel') { drawing = null; paintSelection(); return; }
  const points = selectionMode === 'rectangle' ? rectanglePoints(drawing[0], pointerPoint(event)) : drawing;
  drawing = null;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  if (points.length >= 3 && Math.max(...xs) - Math.min(...xs) > .01 && Math.max(...ys) - Math.min(...ys) > .01) {
    images[imageIndex].points = points; images[imageIndex].selectionType = selectionMode; images[imageIndex].recognized = false; scheduleSave();
  } else toast(selectionMode === 'rectangle' ? '请拖动框选需要识别的区域' : '请按住并围绕文字画出区域');
  paintSelection(); updateSelectionStatus();
}
canvas.addEventListener('pointerup', finishDrawing); canvas.addEventListener('pointercancel', finishDrawing);
$('#previousImage').onclick = () => { if (!busy && imageIndex > 0) { imageIndex--; renderImages(); } };
$('#nextImage').onclick = () => { if (!busy && imageIndex < images.length - 1) { imageIndex++; renderImages(); } };
$('#resetSelection').onclick = () => { if (busy || !images.length) return; images[imageIndex].points = null; images[imageIndex].selectionType = null; images[imageIndex].recognized = false; paintSelection(); updateSelectionStatus(); scheduleSave(); };
async function imageForOcr(entry) {
  const image = await loadImage(entry.blob), points = entry.points;
  const minX = points?.length >= 3 ? Math.min(...points.map(p => p.x)) : 0, minY = points?.length >= 3 ? Math.min(...points.map(p => p.y)) : 0;
  const maxX = points?.length >= 3 ? Math.max(...points.map(p => p.x)) : 1, maxY = points?.length >= 3 ? Math.max(...points.map(p => p.y)) : 1;
  const width = Math.max(1, (maxX - minX) * image.naturalWidth), height = Math.max(1, (maxY - minY) * image.naturalHeight);
  const scale = Math.min(1, 3000 / Math.max(width, height)); const output = document.createElement('canvas'); output.width = Math.max(1, Math.ceil(width * scale)); output.height = Math.max(1, Math.ceil(height * scale)); const ctx = output.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, output.width, output.height);
  if (points?.length >= 3) { ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo((p.x-minX)*image.naturalWidth*scale,(p.y-minY)*image.naturalHeight*scale) : ctx.moveTo((p.x-minX)*image.naturalWidth*scale,(p.y-minY)*image.naturalHeight*scale)); ctx.closePath(); ctx.clip(); }
  ctx.drawImage(image, minX*image.naturalWidth, minY*image.naturalHeight, width, height, 0, 0, output.width, output.height);
  return new Promise((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片处理失败')), 'image/png'));
}
$('#recognizeBtn').onclick = async () => {
  if (busy || !images.length) return;
  const pending = images.filter(image => !image.recognized);
  if (!pending.length) { toast('当前图片已识别；重置选区后可重新识别'); showStage('edit'); return; }
  busy = true; renderImages(); $('#progress').hidden = false;
  try {
    const base = new URL('ocr/', document.baseURI).href.replace(/\/$/, '');
    let current = 0;
    if (!worker) worker = await createWorker('chi_sim+eng', 1, { workerPath: `${base}/worker.min.js`, corePath: base, langPath: base, workerBlobURL: false, gzip: false, logger: m => { const pct = Math.round((m.progress || 0) * 100); $('#progressText').textContent = m.status === 'recognizing text' ? `正在识别第 ${current} / ${pending.length} 张` : '正在加载本地识别模型'; $('#progressPercent').textContent = `${pct}%`; $('#progressBar').style.width = `${pct}%`; } });
    for (const entry of pending) {
      current++; const result = await worker.recognize(await imageForOcr(entry), {}, { text: true, blocks: true }); const text = result.data.text.trim();
      if (text) { const html = formatRecognized(result.data); content.insertAdjacentHTML('beforeend', html); }
      entry.recognized = true; updateCount(); await enqueueSave();
    }
    toast('图片识别完成，可继续整理文字'); busy = false; showStage('edit');
  } catch (error) { console.error(error); worker = null; toast('识别失败，请重试；已识别的图片已保存'); }
  finally { busy = false; $('#progress').hidden = true; renderImages(); }
};
let savedRange = null;
document.addEventListener('selectionchange', () => { const selection = window.getSelection(); if (selection?.rangeCount && content.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange(); });
function restoreSelection() { content.focus(); if (savedRange && content.contains(savedRange.commonAncestorContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); } }
document.querySelectorAll('.toolbar button').forEach(button => button.addEventListener('mousedown', event => event.preventDefault()));
document.querySelectorAll('[data-command]').forEach(button => button.onclick = () => { restoreSelection(); document.execCommand(button.dataset.command, false); updateCount(); scheduleSave(); });
$('#fontSize').onchange = event => { if (!event.target.value) return; restoreSelection(); document.execCommand('fontSize', false, event.target.value); event.target.value = ''; scheduleSave(); };
$('#tableBtn').onclick = () => { restoreSelection(); document.execCommand('insertHTML', false, '<table><tbody><tr><th>标题</th><th>标题</th></tr><tr><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>'); scheduleSave(); };
content.addEventListener('paste', event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); });

let editingFormula = null;
function renderFormulaPreview() {
  const value = $('#mathInput').value.trim(), preview = $('#mathPreview'), error = $('#mathError');
  preview.replaceChildren(); error.textContent = ''; $('#mathSave').disabled = !value;
  if (!value) return;
  try { katex.render(value, preview, { throwOnError: true, trust: false }); }
  catch (err) { error.textContent = '公式格式有误，请检查输入'; $('#mathSave').disabled = true; }
}
function openFormula(target = null) {
  editingFormula = target; $('#mathInput').value = target?.dataset.latex || ''; $('#mathSave').textContent = target ? '保存公式' : '插入公式';
  $('#mathDialog').hidden = false; renderFormulaPreview(); $('#mathInput').focus();
}
$('#mathBtn').onclick = () => openFormula();
content.addEventListener('click', event => { const formula = event.target.closest('.formula'); if (formula && content.contains(formula)) openFormula(formula); });
$('#mathInput').addEventListener('input', renderFormulaPreview);
$('#mathCancel').onclick = () => { $('#mathDialog').hidden = true; editingFormula = null; };
$('#mathSave').onclick = () => {
  const latex = $('#mathInput').value.trim(); if (!latex) return;
  const formula = document.createElement('span'); formula.className = 'formula'; formula.contentEditable = 'false'; formula.dataset.latex = latex; formula.title = '点击编辑公式';
  try { katex.render(latex, formula, { throwOnError: true, trust: false }); } catch { renderFormulaPreview(); return; }
  $('#mathDialog').hidden = true;
  if (editingFormula && content.contains(editingFormula)) editingFormula.replaceWith(formula);
  else { restoreSelection(); document.execCommand('insertHTML', false, formula.outerHTML + '&nbsp;'); }
  editingFormula = null; updateCount(); scheduleSave();
};

async function exportFile(share) {
  try {
    await flushSave(); const format = document.querySelector('input[name="format"]:checked').value; const file = await makeFile(title.value, content.innerHTML, format);
    if (Capacitor.isNativePlatform()) {
      const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const result = await Filesystem.writeFile({ path: `exports/${file.name}`, data: btoa(binary), directory: Directory.Cache, recursive: true });
      await Share.share({ title: file.name, url: result.uri, dialogTitle: share ? '分享文件' : '保存文件' });
      if (!share) toast('请选择保存位置或接收应用');
    } else if (share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: file.name });
    else { const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); toast(share ? '已下载文件，可从下载列表分享' : '文件已下载'); }
  } catch (error) { if (error.name !== 'AbortError' && !String(error.message).includes('canceled')) { console.error(error); toast(error.message || '导出失败，请重试'); } }
}
$('#saveBtn').onclick = () => exportFile(false); $('#shareBtn').onclick = () => exportFile(true);
