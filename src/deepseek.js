import MarkdownIt from 'markdown-it';
import katex from 'katex';

const md = new MarkdownIt({ html: false, linkify: false });
const escape = md.utils.escapeHtml;
function formula(tex, display) {
  const value = tex.trim();
  if (!value) return '';
  const rendered = katex.renderToString(value, { displayMode: display, throwOnError: false, trust: false, output: 'html', macros: { '\\mbox': '\\text' } });
  return `<span class="formula${display ? ' formula-display' : ''}" contenteditable="false" data-latex="${escape(value)}"${display ? ' data-display="true"' : ''} title="点击编辑公式">${rendered}</span>`;
}
md.inline.ruler.before('escape', 'math', (state, silent) => {
  const start = state.pos, src = state.src;
  const open = src.startsWith('$$', start) ? '$$' : src[start] === '$' ? '$' : src.startsWith('\\(', start) ? '\\(' : '';
  if (!open) return false;
  const close = open === '\\(' ? '\\)' : open;
  let end = src.indexOf(close, start + open.length);
  while (end >= 0 && /(^|[^\\])(\\\\)*\\$/.test(src.slice(start + open.length, end))) end = src.indexOf(close, end + close.length);
  if (end < 0 || end >= state.posMax || end === start + open.length) return false;
  if (!silent) { const token = state.push('math_inline', '', 0); token.content = src.slice(start + open.length, end); }
  state.pos = end + close.length; return true;
});
md.renderer.rules.math_inline = (tokens, index) => formula(tokens[index].content, false);
md.block.ruler.before('fence', 'math', (state, start, end, silent) => {
  const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]).trim();
  const open = line.startsWith('$$') ? '$$' : line.startsWith('\\[') ? '\\[' : '';
  if (!open) return false;
  const close = open === '$$' ? '$$' : '\\]';
  let last = start, text = line.slice(open.length), at = text.indexOf(close);
  if (at >= 0 && text.slice(at + close.length).trim()) return false;
  while (at < 0 && ++last < end) { text += '\n' + state.src.slice(state.bMarks[last] + state.tShift[last], state.eMarks[last]); at = text.indexOf(close); }
  if (at < 0 || text.slice(at + close.length).trim()) return false;
  if (!silent) { const token = state.push('math_block', '', 0); token.content = text.slice(0, at); token.map = [start, last + 1]; }
  state.line = last + 1; return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.renderer.rules.math_block = (tokens, index) => `<div>${formula(tokens[index].content, true)}</div>`;

export function renderRecognizedMarkdown(text) {
  const source = String(text).trim().replace(/^```(?:markdown|md)\s*\n([\s\S]*?)\n```\s*$/i, '$1');
  return md.render(source);
}
export function parseApiKey(input) {
  const text = String(input || '').trim().replace(/^\uFEFF/, '');
  const match = text.match(/^(?:export\s+)?(?:DEEPSEEK_API_KEY|API_KEY)\s*=\s*(.+)$/m);
  const key = (match ? match[1] : text).trim().replace(/^['"]|['"]$/g, '');
  if (!key || /[\r\n\s]/.test(key) || key.includes('=')) throw new Error('密钥格式无效，请粘贴密钥或导入包含 API_KEY 的文件');
  return key;
}
export async function recognizeWithDeepSeek(imageDataUrl, key, request) {
  const body = { model: 'deepseek-flash', max_tokens: 8192, temperature: 0, thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: [
      { type: 'text', text: '请忠实识别图片中的全部可见文字并按阅读顺序输出 Markdown。保留标题、段落、列表、表格和公式；数学公式使用 $...$ 或独立的 $$...$$ LaTeX。不要补充图片中没有的内容，不确定的字符标记为 [无法辨认]。只输出识别结果，不要解释。' },
      { type: 'image_url', image_url: { url: imageDataUrl, detail: 'original' } }
    ] }] };
  const response = await request({ url: 'https://api.deepseek.com/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, data: body });
  if (response.status === 401 || response.status === 403) throw new Error('DeepSeek 密钥无效或无权限，请检查密钥');
  if (response.status === 402) throw new Error('DeepSeek 账户余额不足，请充值后重试');
  if (response.status === 429) throw new Error('DeepSeek 请求过于频繁，请稍后重试');
  if (response.status < 200 || response.status >= 300) throw new Error(`DeepSeek 请求失败（HTTP ${response.status}）`);
  const result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  const choice = result?.choices?.[0];
  if (choice?.finish_reason === 'length') throw new Error('识别结果过长，请缩小选区后重试');
  const text = choice?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('DeepSeek 没有返回识别结果，请重试');
  return text.trim();
}
