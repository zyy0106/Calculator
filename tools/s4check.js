// S4 browser check for the constants panel. Run from the test scaffold dir:
//   cd %TEMP%\webcasio-test; node C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\s4check.js
const path = require('path');
const { open, press } = require(path.join(process.env.TEMP, 'webcasio-test', 'harness.js'));
const click = (page, sel) => page.evaluate(s => { const b=[...document.querySelectorAll('[onclick]')].find(b=>b.getAttribute('onclick')===s && b.offsetParent!==null) || [...document.querySelectorAll('[onclick]')].find(b=>b.getAttribute('onclick')===s); if(!b) throw new Error('no '+s); b.click(); }, sel);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
(async () => {
  const { browser, page, errors } = await open();
  const st = () => page.evaluate(() => {
    const disp = document.getElementById('single-line-display');
    const d = EditorCore.__dbg(EditorCore.activeEditorKey());
    return { ser: d.ser, tex: d.tex, cursors: disp.querySelectorAll('.cursor-blink').length, err: /过于复杂/.test(disp.innerText),
      res: document.getElementById('calc-res-val').innerText,
      panel: getComputedStyle(document.getElementById('const-panel')).display,
      kb: getComputedStyle(document.getElementById('keyboard-area')).display,
      btnActive: document.getElementById('btn-const').classList.contains('active') };
  });
  const cellBox = id => page.evaluate(id => { const r = document.querySelector('.const-cell[data-id="'+id+'"]'); r.scrollIntoView({block:'center'}); const b = r.getBoundingClientRect(); return { x: b.x + b.width/2, y: b.y + b.height/2 }; }, id);
  const tap = async (id, holdMs = 60, dy = 0) => { const p = await cellBox(id); await page.mouse.move(p.x, p.y); await page.mouse.down(); if (dy) await page.mouse.move(p.x, p.y + dy, { steps: 4 }); await page.waitForTimeout(holdMs); const shown = await page.evaluate(id => document.querySelector('.const-cell[data-id="'+id+'"]').classList.contains('show-val'), id); const valText = await page.evaluate(id => document.querySelector('.const-cell[data-id="'+id+'"] .c-val').innerText.replace(/\s+/g,''), id); await page.mouse.up(); return { shown, valText }; };

  // layout
  let s = await st();
  ok(s.panel === 'none' && s.kb === 'grid', 'initial: panel hidden, keyboard shown');
  const rowInfo = await page.evaluate(() => { const row = document.getElementById('var-btns-row'); const b = document.getElementById('btn-const'); return { n: row.children.length, last: row.lastElementChild.id, over: b.scrollWidth > b.clientWidth, w: b.clientWidth }; });
  ok(rowInfo.n === 7 && rowInfo.last === 'btn-const' && !rowInfo.over, 'const button is 7th child of var row, text fits (w=' + rowInfo.w + ')');
  const before = await page.evaluate(() => document.getElementById('main-screen').getBoundingClientRect().height);
  await click(page, 'toggleConstPanel()');
  s = await st();
  const after = await page.evaluate(() => document.getElementById('main-screen').getBoundingClientRect().height);
  ok(s.panel === 'flex' && s.kb === 'none' && s.btnActive, 'open: panel shown, keyboard hidden, button active');
  ok(before === after, 'formula box height unchanged (' + before + ' -> ' + after + ')');
  const lay = await page.evaluate(() => { const cells = [...document.querySelectorAll('.const-cell')]; const xs = new Set(cells.map(c => Math.round(c.getBoundingClientRect().x))); const list = document.getElementById('const-list'); const calc = document.querySelector('.calculator').getBoundingClientRect(); const lb = list.getBoundingClientRect(); return { n: cells.length, cols: xs.size, titles: document.querySelectorAll('.const-group-title').length, scroll: list.scrollHeight > list.clientHeight, inside: lb.bottom <= calc.bottom + 0.5, overflowNames: cells.filter(c => { const n = c.querySelector('.c-name'); return n.scrollWidth > n.clientWidth; }).map(c => c.dataset.id), katexErr: document.querySelectorAll('#const-list .katex-error').length }; });
  ok(lay.n === 53 && lay.cols === 2 && lay.titles === 7, 'panel: 53 cells, 2 columns, 7 group titles');
  ok(lay.scroll && lay.inside, 'list scrolls inside calculator');
  ok(lay.katexErr === 0, 'no KaTeX errors in cells');
  console.log('INFO truncated names (ellipsis): ' + JSON.stringify(lay.overflowNames));
  // long-press value view overflow
  const valOver = await page.evaluate(() => [...document.querySelectorAll('.const-cell')].filter(c => { c.classList.add('show-val'); const o = c.scrollWidth > c.clientWidth + 1; c.classList.remove('show-val'); return o; }).map(c => c.dataset.id));
  ok(valOver.length === 0, 'long-press values fit in cell ' + JSON.stringify(valOver));

  // short press inserts atom; display tex
  await click(page, 'clearAll()');
  let t = await tap('c0');
  s = await st();
  ok(!t.shown && s.ser.includes('299792458') && s.cursors === 1 && !s.err, 'short press c0 inserts: ser=' + s.ser);
  // long press: shows value, no insertion
  const serBefore = s.ser;
  t = await tap('qe', 700);
  s = await st();
  ok(t.shown && t.valText.includes('1.602176634') && s.ser === serBefore, 'long press qe shows ' + t.valText + ', not inserted');
  ok(await page.evaluate(() => document.querySelectorAll('.const-cell.show-val').length === 0), 'released: back to symbol view');
  // drag (scroll gesture) cancels
  t = await tap('h', 100, 20);
  s = await st();
  ok(s.ser === serBefore, 'drag >8px does not insert');
  // atomic delete
  await tap('eps0');
  s = await st();
  const withEps = s.ser;
  await click(page, 'deleteLast()');
  s = await st();
  ok(withEps !== serBefore && s.ser === serBefore, 'one DEL removes eps0 atom wholly');
  // compute c0^2-ish: c0 * 2 via keyboard after returning
  await click(page, 'toggleConstPanel()');
  s = await st();
  ok(s.panel === 'none' && s.kb === 'grid' && !s.btnActive, 'return-to-keyboard restores keyboard');
  for (const k of ['*', '2', '=']) await press(page, k);
  s = await st();
  ok(s.res.replace(/\s/g,'') === '=5.99584916e+8', 'c0*2 = ' + s.res);

  // qe * NA = F (Faraday)
  await press(page, 'AC');
  await click(page, 'toggleConstPanel()');
  await tap('qe');
  await click(page, 'toggleConstPanel()');
  await press(page, '*');
  await click(page, 'toggleConstPanel()');
  await tap('NA');
  await press(page, '=');
  s = await st();
  ok(/96485\.33212/.test(s.res), 'qe*NA = ' + s.res);
  // panel toolbar: L, DEL, return; '=' stays reachable via keyboard
  await press(page, 'AC');
  await tap('mue');               // negative constant
  await press(page, '*');         // keyboard hidden -> press falls back to hidden button; ok for logic test
  await tap('pi');
  await press(page, '=');
  s = await st();
  ok(Math.abs(parseFloat(s.res.replace(/^=\s*/,'')) - (-9.2847647043e-24 * Math.PI)) < 1e-30, 'mue*pi = ' + s.res);
  // implicit multiplication: 2 hbar
  await press(page, 'AC'); await press(page, '2'); await tap('hbar'); await press(page, '=');
  s = await st();
  ok(/2\.1091436/.test(s.res), '2 hbar = ' + s.res);

  // mode switch closes panel
  await click(page, "switchMode('plot')");
  s = await st();
  ok(s.panel === 'none' && s.kb === 'none' && !s.btnActive, 'plot: panel closed, keyboard hidden');
  await click(page, "switchMode('vars')");
  s = await st();
  ok(s.panel === 'none' && s.kb === 'grid', 'vars: keyboard back');
  await click(page, "selectVar('b')");
  await press(page, 'AC');
  await click(page, 'toggleConstPanel()');
  await tap('me'); 
  await press(page, '=');
  s = await st();
  const vb = await page.evaluate(() => document.getElementById('vval-b').innerText);
  ok(/9\.109/.test(s.res) && /9\.10938/.test(vb), 'var b = me: res=' + s.res + ' panel=' + vb);
  await click(page, "switchMode('main')");
  s = await st();
  ok(s.panel === 'none' && s.kb === 'grid', 'main: panel closed after mode switch');
  await press(page, 'AC'); await press(page, 'b'); await press(page, '/'); await click(page, 'toggleConstPanel()'); await tap('me'); await press(page, '=');
  s = await st();
  ok(s.res.replace(/\s/g,'') === '=1', 'b/me = ' + s.res);

  await page.screenshot({ path: path.join(process.env.TEMP, 'webcasio-test', 's4-panel.png') });
  await tap('Phi0', 700).catch(() => {});
  const p = await cellBox('Phi0'); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(process.env.TEMP, 'webcasio-test', 's4-longpress.png') });
  await page.mouse.up();

  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  console.log(fails ? 'S4CHECK FAIL ' + fails : 'S4CHECK OK');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
