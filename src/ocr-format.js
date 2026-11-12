const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function joiner(left, right) {
  return /[a-zA-Z0-9]$/.test(left) && /^[a-zA-Z0-9]/.test(right) ? ' ' : '';
}
export function formatRecognized(data) {
  const paragraphs = (data.blocks || []).flatMap(block => block.paragraphs || []);
  const lines = paragraphs.flatMap(p => p.lines || []).filter(line => line.text?.trim());
  if (!lines.length) return (data.text || '').trim().split(/\n\s*\n/).map(part => { const pieces = part.split(/\r?\n/).map(x => x.trim()).filter(Boolean); const merged = pieces.reduce((all, next) => all + (all ? joiner(all, next) : '') + next, ''); return `<p>${escape(merged)}</p>`; }).join('');
  const heights = lines.map(line => line.bbox?.y1 - line.bbox?.y0).filter(n => Number.isFinite(n) && n > 0).sort((a,b) => a-b);
  const median = heights[Math.floor(heights.length / 2)] || 1;
  let result = '', activeList = null;
  const close = () => { if (activeList) { result += `</${activeList}>`; activeList = null; } };
  for (const paragraph of paragraphs) {
    const paragraphLines = (paragraph.lines || []).filter(line => line.text?.trim());
    const maxWidth = Math.max(1, ...paragraphLines.map(line => (line.bbox?.x1 || 0) - (line.bbox?.x0 || 0)));
    let current = '', previous = null, currentSize = '';
    const flush = () => { if (current) { close(); result += `<p>${current}</p>`; current = ''; previous = null; currentSize = ''; } };
    for (const line of paragraphLines) {
      const text = line.text.trim(), list = text.match(/^(?:([•●▪◦‣*\-])\s+|(\d{1,3})[.、)]\s*)(.+)$/);
      if (list) {
        flush(); const type = list[2] ? 'ol' : 'ul'; if (activeList !== type) { close(); result += `<${type}>`; activeList = type; }
        result += `<li>${escape(list[3])}</li>`; continue;
      }
      close();
      const height = (line.bbox?.y1 || 0) - (line.bbox?.y0 || 0);
      const size = height > median * 1.45 ? '5' : height > 0 && height < median * .7 ? '2' : '';
      const width = previous ? (previous.bbox?.x1 || 0) - (previous.bbox?.x0 || 0) : 0;
      const gap = previous ? (line.bbox?.y0 || 0) - (previous.bbox?.y1 || 0) : 0;
      const indent = previous ? (line.bbox?.x0 || 0) - (previous.bbox?.x0 || 0) : 0;
      const previousText = previous?.text?.trim() || '';
      const explicitBreak = previous && (size !== currentSize || gap > median * 1.2 || (/[。！？!?；;]$/.test(previousText) && (width < maxWidth * .65 || indent > median * .8)));
      if (explicitBreak) flush();
      const value = escape(text), formatted = size ? `<font size="${size}">${value}</font>` : value;
      current += previous ? joiner(previousText, text) + formatted : formatted;
      currentSize = size; previous = line;
    }
    flush();
  }
  close(); return result;
}
