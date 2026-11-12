import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, LevelFormat } from 'docx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const safeName = name => (name.trim() || '未命名文档').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 80);
const sizes = { 1: 16, 2: 20, 3: 24, 4: 28, 5: 36, 6: 48, 7: 72 };
function runs(node, style = {}) {
  if (node.nodeType === Node.TEXT_NODE) return [new TextRun({ text: node.textContent, ...style })];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return [new TextRun({ break: 1 })];
  const next = { ...style };
  if (['strong', 'b'].includes(tag)) next.bold = true;
  if (['em', 'i'].includes(tag)) next.italics = true;
  if (tag === 'u') next.underline = {};
  if (tag === 'font' && sizes[node.getAttribute('size')]) next.size = sizes[node.getAttribute('size')];
  return Array.from(node.childNodes).flatMap(child => runs(child, next));
}
function blocks(parent, listType = null, level = 0) {
  const result = []; let pending = [];
  const flush = () => { if (pending.length) { result.push(new Paragraph({ children: pending })); pending = []; } };
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) { if (node.textContent.trim()) pending.push(...runs(node)); continue; }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === 'table') {
      flush(); const rows = [...node.rows].map(row => new TableRow({ children: [...row.cells].map(cell => new TableCell({ children: blocks(cell).length ? blocks(cell) : [new Paragraph('')] })) }));
      if (rows.length) result.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    } else if (tag === 'ul' || tag === 'ol') { flush(); result.push(...blocks(node, tag, level)); }
    else if (tag === 'li') {
      flush(); const nested = [...node.children].filter(el => ['UL', 'OL'].includes(el.tagName));
      const children = [...node.childNodes].filter(n => !nested.includes(n)).flatMap(n => runs(n));
      result.push(new Paragraph({ children, ...(listType === 'ol' ? { numbering: { reference: 'numbered', level: Math.min(level, 8) } } : { bullet: { level: Math.min(level, 8) } }) }));
      for (const child of nested) result.push(...blocks(child, child.tagName.toLowerCase(), level + 1));
    } else if (['div', 'p', 'h1', 'h2', 'h3'].includes(tag)) {
      flush();
      if ([...node.children].some(el => ['UL', 'OL', 'TABLE', 'DIV', 'P'].includes(el.tagName))) result.push(...blocks(node));
      else result.push(new Paragraph({ children: runs(node), spacing: { after: 100 }, ...(tag === 'h1' ? { heading: 'Heading1' } : {}) }));
    } else pending.push(...runs(node));
  }
  flush(); return result;
}
export async function makeFile(title, html, format) {
  const root = document.createElement('div'); root.innerHTML = html;
  if (!root.textContent.trim()) throw new Error('请先识别或输入文字');
  const name = safeName(title);
  if (format === 'md') {
    const markdown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' }); markdown.use(gfm);
    return new File([markdown.turndown(root)], `${name}.md`, { type: 'text/markdown;charset=utf-8' });
  }
  if (format === 'docx') {
    const doc = new Document({ numbering: { config: [{ reference: 'numbered', levels: Array.from({ length: 9 }, (_, level) => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.START })) }] }, sections: [{ children: blocks(root) }] });
    return new File([await Packer.toBlob(doc)], `${name}.docx`, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  const container = document.createElement('div'); container.className = 'pdf-render rich-content'; container.innerHTML = html; document.body.append(container);
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 1.5, useCORS: false });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' }); const pageWidth = 190, pageHeight = 277;
    const sliceHeight = Math.floor(canvas.width * pageHeight / pageWidth); let offset = 0, page = 0;
    while (offset < canvas.height) {
      const slice = document.createElement('canvas'); slice.width = canvas.width; slice.height = Math.min(sliceHeight, canvas.height - offset);
      slice.getContext('2d').drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (page++) pdf.addPage(); pdf.addImage(slice.toDataURL('image/jpeg', .94), 'JPEG', 10, 10, pageWidth, slice.height * pageWidth / canvas.width); offset += sliceHeight;
    }
    return new File([pdf.output('blob')], `${name}.pdf`, { type: 'application/pdf' });
  } finally { container.remove(); }
}
