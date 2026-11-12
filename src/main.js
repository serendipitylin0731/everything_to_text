import './style.css';
import { createWorker } from 'tesseract.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const $ = (s) => document.querySelector(s);
$('#app').innerHTML = `
<main><div id="homePage" class="page"><section class="intro"><div><div class="eyebrow"><span></span> 你的随身文字助手</div><h1>看见文字，<br><em>留住灵感。</em></h1><p>拍下眼前的文字，整理成你想要的样子。<br>从纸上到屏幕，只需要一瞬间。</p></div><div class="intro-art" aria-hidden="true"><div class="art-paper"><i></i><i></i><i></i><i></i><b>字</b></div><span class="spark one">✳</span><span class="spark two">✧</span></div></section><section class="home-action"><div class="home-action-icon">◎</div><div><h2>开始拾取文字</h2><p>拍照或选择图片，把纸上的内容整理成文档。</p></div><button class="button primary" id="startBtn">开始识别 <span>→</span></button></section><section class="home-tips"><h2>简单三步，整理好文字</h2><div class="tip-grid"><div><span>01</span><strong>添加图片</strong><p>拍一张照片，或从相册选择</p></div><div><span>02</span><strong>识别与编辑</strong><p>提取文字，自由修改调整</p></div><div><span>03</span><strong>导出与分享</strong><p>选择格式，保存或转发</p></div></div></section></div>
<div id="recognizePage" class="page" hidden><div class="page-header"><span class="step">CAPTURE & EDIT</span><h1>识别文字</h1><p>让图片中的文字，变得触手可及。</p></div><section class="workspace"><div class="section-heading"><div><span class="step">01 / 拾取</span><h2>添加图片</h2></div><span class="subtle">支持拍照或从相册选择</span></div><div class="upload-card" id="uploadCard"><div class="upload-icon">⌗</div><div class="upload-copy"><strong>从一张图片开始</strong><span>书页、笔记、文档，都可以试试</span></div><div class="upload-actions"><button class="button primary" id="cameraBtn"><span>◎</span> 拍照识字</button><button class="button secondary" id="galleryBtn">选择图片 <span>↗</span></button></div><input id="cameraInput" type="file" accept="image/*" capture="environment" hidden><input id="galleryInput" type="file" accept="image/*" hidden></div><div class="image-panel" id="imagePanel" hidden><img id="imagePreview" alt="待识别图片"><div><strong id="imageName"></strong><p>图片已准备好，可以开始识别</p><button class="text-button" id="replaceBtn">重新选择图片 ↗</button></div><button class="button primary" id="recognizeBtn">开始识别 <span>→</span></button></div><div class="progress" id="progress" hidden><div><span id="progressText">正在准备识别…</span><span id="progressPercent"></span></div><div class="progress-track"><div id="progressBar"></div></div></div><p class="hint">✳ &nbsp; 首次识别需联网加载语言模型，清晰、光线充足的图片效果更好。</p></section>
<section class="workspace editor-section"><div class="section-heading"><div><span class="step">02 / 整理</span><h2>文字工作台</h2></div><span class="subtle">识别后可自由修改</span></div><div class="editor-card"><div class="editor-top"><div class="editor-label"><span class="green-dot"></span> 编辑与预览</div><span id="count">0 字</span></div><label class="sr-only" for="title">文档标题</label><input id="title" class="title-input" maxlength="80" placeholder="给文档起个名字" value="未命名文档"><label class="sr-only" for="content">识别出的文字</label><textarea id="content" placeholder="识别后的文字会出现在这里…&#10;&#10;你也可以直接在这里输入或粘贴文字。"></textarea><div class="editor-bottom"><span>✎ &nbsp; 点击文字即可编辑</span><button class="text-button" id="clearBtn">清空内容</button></div></div></section>
<section class="workspace export-section"><div class="section-heading"><div><span class="step">03 / 带走</span><h2>导出与分享</h2></div><span class="subtle">让好内容继续流动</span></div><div class="export-card"><div><strong>选择你需要的格式</strong><p>整理完成后，保存或直接分享给朋友。</p></div><div class="export-controls"><div class="formats" role="radiogroup" aria-label="导出格式"><label><input type="radio" name="format" value="md" checked><span>MD <small>Markdown</small></span></label><label><input type="radio" name="format" value="docx"><span>DOCX <small>Word 文档</small></span></label><label><input type="radio" name="format" value="pdf"><span>PDF <small>便携文档</small></span></label></div><div class="export-buttons"><button class="button secondary" id="saveBtn">↓ &nbsp; 保存文件</button><button class="button primary" id="shareBtn">↗ &nbsp; 导出并分享</button></div></div></div></section>
</div><div id="historyPage" class="page" hidden><div class="page-header"><span class="step">YOUR COLLECTION</span><h1>我的历史</h1><p>保存过的文字，都在这里。</p></div><div class="history-heading"><h2>文字记录</h2><span id="historyCount"></span></div><div id="historyList" class="history-list"></div></div></main><nav class="bottom-nav" aria-label="主导航"><button class="nav-item active" data-page="home" aria-current="page"><span aria-hidden="true">⌂</span>首页</button><button class="nav-item" data-page="recognize"><span aria-hidden="true">▣</span>识别</button><button class="nav-item" data-page="history"><span aria-hidden="true">◷</span>我的历史</button></nav><div id="toast" role="status" aria-live="polite"></div>`;

let imageFile = null, imageUrl = null, worker = null, busy = false;
const content = $('#content');
const toast = (message) => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3500); };

const HISTORY_KEY = 'shizi.history.v1';
let currentId = null;
function getHistory() {
  try { const records = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(records) ? records : []; }
  catch { return []; }
}
function saveHistory() {
  if (!content.value.trim()) return;
  const records = getHistory();
  const record = { id: currentId || `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: $('#title').value.trim() || '未命名文档', text: content.value, updatedAt: Date.now() };
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([record, ...records.filter(item => item.id !== record.id)]));
    currentId = record.id;
  } catch (error) { console.error(error); toast('历史记录保存失败，请检查设备存储空间'); }
}
function renderHistory() {
  const records = getHistory(); const list = $('#historyList');
  $('#historyCount').textContent = `${records.length} 条记录`; list.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('div'); empty.className = 'history-empty';
    empty.innerHTML = '<div>◷</div><strong>还没有文字记录</strong><p>识别或输入的文字会自动保存在这里。</p><button class="button primary" type="button">开始识别 →</button>';
    empty.querySelector('button').onclick = () => showPage('recognize'); list.append(empty); return;
  }
  for (const record of records) {
    const card = document.createElement('article'); card.className = 'history-card';
    const open = document.createElement('button'); open.className = 'history-open'; open.type = 'button';
    const title = document.createElement('strong'); title.textContent = record.title;
    const preview = document.createElement('p'); preview.textContent = record.text;
    const date = document.createElement('span'); date.textContent = new Date(record.updatedAt).toLocaleString('zh-CN');
    open.append(title, preview, date);
    open.onclick = () => { saveHistory(); currentId = record.id; $('#title').value = record.title; content.value = record.text; content.dispatchEvent(new Event('input')); $('#imagePanel').hidden = true; $('#uploadCard').hidden = false; imageFile = null; showPage('recognize'); };
    const del = document.createElement('button'); del.type = 'button'; del.className = 'history-delete'; del.textContent = '删除'; del.setAttribute('aria-label', `删除 ${record.title}`);
    del.onclick = () => {
      if (!confirm(`确定删除“${record.title}”吗？`)) return;
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(item => item.id !== record.id))); if (currentId === record.id) { clearTimeout(saveTimer); currentId = null; content.value = ''; $('#title').value = '未命名文档'; $('#count').textContent = '0 字'; } renderHistory(); }
      catch (error) { console.error(error); toast('删除失败，请重试'); }
    };
    card.append(open, del); list.append(card);
  }
}
function showPage(page) {
  if (page === 'history') { saveHistory(); renderHistory(); }
  for (const name of ['home', 'recognize', 'history']) $(`#${name}Page`).hidden = name !== page;
  document.querySelectorAll('.nav-item').forEach(button => { const active = button.dataset.page === page; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
}
document.querySelectorAll('.nav-item').forEach(button => button.onclick = () => showPage(button.dataset.page));
$('#startBtn').onclick = () => showPage('recognize');
let saveTimer;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveHistory, 400); }
content.addEventListener('input', scheduleSave);
$('#title').addEventListener('input', scheduleSave);
window.addEventListener('pagehide', saveHistory);

$('#cameraBtn').onclick = () => $('#cameraInput').click();
$('#galleryBtn').onclick = $('#replaceBtn').onclick = () => $('#galleryInput').click();
for (const input of [$('#cameraInput'), $('#galleryInput')]) input.onchange = () => {
  const file = input.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
  imageFile = file; if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = URL.createObjectURL(file);
  $('#imagePreview').src = imageUrl; $('#imageName').textContent = file.name || '已选择图片';
  $('#uploadCard').hidden = true; $('#imagePanel').hidden = false; input.value = '';
};
content.addEventListener('input', () => { $('#count').textContent = `${Array.from(content.value).length} 字`; });
$('#clearBtn').onclick = () => { if (!content.value || confirm('确定清空工作台中的文字吗？')) { content.value = ''; currentId = null; content.dispatchEvent(new Event('input')); } };
$('#recognizeBtn').onclick = async () => {
  if (!imageFile || busy) return;
  if (content.value.trim() && !confirm('识别结果将替换当前文字，继续吗？')) return;
  busy = true; $('#recognizeBtn').disabled = true; $('#progress').hidden = false;
  try {
    if (!worker) worker = await createWorker('chi_sim+eng', 1, { logger: m => {
      const labels = { 'loading tesseract core': '正在加载识别引擎', 'initializing tesseract': '正在初始化', 'loading language traineddata': '正在下载语言模型', 'initializing api': '正在准备识别', 'recognizing text': '正在识别文字' };
      $('#progressText').textContent = labels[m.status] || '正在准备识别';
      const pct = Math.round((m.progress || 0) * 100); $('#progressPercent').textContent = `${pct}%`; $('#progressBar').style.width = `${pct}%`;
    }});
    const result = await worker.recognize(imageFile); if (result.data.text.trim()) { saveHistory(); currentId = null; $('#title').value = '未命名文档'; } content.value = result.data.text.trim(); content.dispatchEvent(new Event('input'));
    toast(content.value ? '识别完成，可以开始编辑' : '没有识别到文字，请尝试更清晰的图片');
    if (content.value) content.focus();
  } catch (error) { console.error(error); worker = null; toast('识别失败，请检查网络后重试'); }
  finally { busy = false; $('#recognizeBtn').disabled = false; $('#progress').hidden = true; }
};
function filename() { return ($('#title').value.trim() || '未命名文档').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 80); }
async function makeFile() {
  const text = content.value; if (!text.trim()) throw new Error('请先识别或输入文字');
  const title = filename(); const format = document.querySelector('input[name="format"]:checked').value;
  if (format === 'md') return new File([text], `${title}.md`, { type: 'text/markdown;charset=utf-8' });
  if (format === 'docx') {
    const doc = new Document({ sections: [{ children: text.split(/\r?\n/).map(line => new Paragraph({ children: [new TextRun({ text: line, font: 'Microsoft YaHei', size: 24 })], spacing: { after: 100 } })) }] });
    return new File([await Packer.toBlob(doc)], `${title}.docx`, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  // Render with the device's CJK font so Chinese works without downloading a font.
  const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext('2d'); const pdf = new jsPDF({ unit: 'px', format: [1240, 1754], hotfixes: ['px_scaling'] });
  const left = 100, maxWidth = 1040, lineHeight = 54, bottom = 1634; let y = 120, page = 0;
  const startPage = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#181a18'; ctx.font = '30px sans-serif'; ctx.textBaseline = 'top'; y = 120; };
  const flush = () => { if (page++) pdf.addPage(); pdf.addImage(canvas.toDataURL('image/jpeg', .94), 'JPEG', 0, 0, 1240, 1754); };
  startPage();
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const char of Array.from(paragraph)) { if (ctx.measureText(line + char).width > maxWidth && line) { if (y + lineHeight > bottom) { flush(); startPage(); } ctx.fillText(line, left, y); y += lineHeight; line = char; } else line += char; }
    if (y + lineHeight > bottom) { flush(); startPage(); } ctx.fillText(line, left, y); y += lineHeight;
  }
  flush(); return new File([pdf.output('blob')], `${title}.pdf`, { type: 'application/pdf' });
}
async function exportFile(share) {
  try {
    const file = await makeFile();
    if (Capacitor.isNativePlatform()) {
      const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const result = await Filesystem.writeFile({ path: `exports/${file.name}`, data: btoa(binary), directory: Directory.Cache, recursive: true });
      await Share.share({ title: file.name, url: result.uri, dialogTitle: share ? '分享文件' : '保存文件' });
      if (!share) toast('请选择保存位置或接收应用');
    } else if (share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: file.name });
    } else {
      const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast(share ? '已下载文件，可从下载列表分享' : '文件已下载');
    }
  } catch (error) { if (error.name !== 'AbortError' && !String(error.message).includes('canceled')) { console.error(error); toast(error.message || '导出失败，请重试'); } }
}
$('#saveBtn').onclick = () => exportFile(false); $('#shareBtn').onclick = () => exportFile(true);
