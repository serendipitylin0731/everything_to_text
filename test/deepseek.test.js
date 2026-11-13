import test from 'node:test';
import assert from 'node:assert/strict';
import { parseApiKey, recognizeWithDeepSeek, renderRecognizedMarkdown } from '../src/deepseek.js';

test('imports a key and sends the chosen image to DeepSeek', async () => {
  assert.equal(parseApiKey('API_KEY="sk-test"\n'), 'sk-test');
  assert.throws(() => parseApiKey('API_KEY=\nOTHER=x'));
  const result = await recognizeWithDeepSeek('data:image/png;base64,YWJj', 'sk-test', async request => {
    assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
    assert.equal(request.headers.Authorization, 'Bearer sk-test');
    assert.equal(request.data.model, 'deepseek-flash');
    assert.equal(request.data.messages[0].content[1].image_url.url, 'data:image/png;base64,YWJj');
    return { status: 200, data: { choices: [{ finish_reason: 'stop', message: { content: '正文 $x^2$' } }] } };
  });
  assert.equal(result, '正文 $x^2$');
  await assert.rejects(recognizeWithDeepSeek('', 'bad', async () => ({status:401})), /密钥/);
  await assert.rejects(recognizeWithDeepSeek('', 'key', async () => ({status:200,data:{choices:[{finish_reason:'length'}]}})), /过长/);
});

test('recognized Markdown renders editable formulas without executing HTML', () => {
  const html = renderRecognizedMarkdown('# 标题\n\n正文 $x^2$\n\n$$\nB=\\mu_0 H\n$$\n\n<script>alert(1)</script>');
  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /data-latex="x\^2"/);
  assert.match(html, /data-display="true"/);
  assert.match(html, /data-latex="B=\\mu_0 H"/);
  assert.doesNotMatch(html, /<script>/);
});
