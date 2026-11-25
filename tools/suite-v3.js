// WebCASIO v3 regression baseline (V1). Supersedes tools/suite-v2.js (kept as history).
// Every case runs in its own try/catch: one failure never aborts later cases.
// Needs playwright-core (NOT a repo dependency): set PW_NODE_MODULES to a node_modules that has it.
// Browser: headless Edge via tools/harness.js. Long-press cases use real time (pointerdown, wait 500ms, move, up).
// Run: node tools\suite-v3.js        (--list prints every case)
'use strict';
const path = require('path'); const Module = require('module');
try { require.resolve('playwright-core'); } catch (e) {
  process.env.NODE_PATH = [process.env.NODE_PATH, process.env.PW_NODE_MODULES,
    path.join(process.env.TEMP || '', 'webcasio-test', 'node_modules')].filter(Boolean).join(path.delimiter);
  Module._initPaths();
}
const { open } = require('./harness.js');
const FILE = 'file:///' + path.resolve(process.env.CALC || path.join(__dirname, '..', 'www', 'index.html')).replace(/\\/g, '/');
const R = []; const NUM = {};
async function T(sec, name, fn) {
  try { const v = await fn(); const ok = v === true || (v && v.ok === true);
    R.push({ sec, name, pass: ok, info: ok ? '' : JSON.stringify(v && v.info !== undefined ? v.info : v).slice(0, 220) }); }
  catch (e) { R.push({ sec, name, pass: false, info: 'EXC ' + String(e && e.message || e).split('\n')[0].slice(0, 200) }); }
}
const chk = (ok, info) => ({ ok: !!ok, info });
const num = s => { const m = /=\s*(-?[0-9.]+(?:e[+-]?\d+)?)/i.exec(s || ''); return m ? parseFloat(m[1]) : NaN; };
const near = (a, b, t = 1e-8) => Number.isFinite(a) && Math.abs(a - b) <= t * Math.max(1, Math.abs(b));
const EXP = {
  r2: 'f(x),g(x),∫,d/dx,←,→', r3: ',√,x2,ln,(,)', r4: 'sin,cos,tan,π,e',
  r5: '7,8,9,DEL,AC', r6: '4,5,6,×,÷', r7: '1,2,3,+,-', r8: '0,.,×10n,Ans,=' };

async function newPage(browser, w, h, errs) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(FILE); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
  return p;
}
const st = p => p.evaluate(() => { const k = EditorCore.activeEditorKey();
  return { ser: EditorCore.serialize(k), res: document.getElementById('calc-res-val').innerText }; });
const prep = (p, pre) => p.evaluate(pre => { switchMode('main'); clearAll(); (pre || []).forEach(x => x === 'R' ? moveCursor(1) : append(x)); }, pre);
const feed = (p, seq) => p.evaluate(seq => { seq.forEach(x => x === 'R' ? moveCursor(1) : append(x)); calculate(); }, seq);
const center = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null;
  const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; }, sel);
const bubble = p => p.evaluate(() => { const b = document.querySelector('.lpb'); if (!b) return null; const r = b.getBoundingClientRect();
  return { L: r.left, R: r.right, T: r.top, B: r.bottom, vw: document.documentElement.clientWidth, vh: innerHeight,
    items: [...b.querySelectorAll('.lpb-item')].map(i => { const q = i.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, h: q.height, t: i.innerText }; }) }; });
// long press: real pointer events (Playwright mouse -> pointerdown/move/up)
async function longPress(p, id, pick, via) {
  const c = await center(p, '#' + id); if (!c) throw new Error('no #' + id);
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.waitForTimeout(500);
  const b = await bubble(p); if (!b) { await p.mouse.up(); throw new Error('bubble not shown ' + id); }
  const held = (await center(p, '#' + id)).h;   // pressed button: button:active scale(0.94) applies while held
  if (via !== undefined) { const v = b.items[via]; await p.mouse.move(v.x, v.y, { steps: 4 }); await p.waitForTimeout(30); }
  if (pick === 'blank') await p.mouse.move(3, 3, { steps: 5 });
  else { const t = b.items[pick]; await p.mouse.move(t.x, t.y, { steps: 5 }); }
  await p.mouse.up(); await p.waitForTimeout(40);
  return { b, btnH: c.h, held, gone: (await bubble(p)) === null };
}
async function tap(p, id) { const c = await center(p, '#' + id); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(30); }
const geomOk = (r, n) => r.b.items.length === n && r.b.items.every(i => Math.abs(i.h - r.held * 2 / 3) <= 0.6)
  && r.b.L >= -0.5 && r.b.R <= r.b.vw + 0.5 && r.b.T >= -0.5 && r.b.B <= r.b.vh + 0.5 && r.gone;

(async () => {
  const t0 = Date.now(); const errs = [];
  const o = await open(); const browser = o.browser; o.page.on('pageerror', e => errs.push(String(e)));
  try {
    const p = await newPage(browser, 420, 860, errs);

    // ---- K: keyboard structure in the three tabs ----
    for (const tab of ['vars', 'main', 'funcs']) {
      const k = await p.evaluate(tab => { switchMode(tab); const rows = [...document.querySelectorAll('#keyboard-area > div')];
        return { rows: rows.map(d => [...d.children].map(b => b.innerText.replace(/\s+/g, '')).join(',')),
          cols: rows.map(d => getComputedStyle(d).gridTemplateColumns.split(' ').length),
          frac: rows[1] && rows[1].children[0].getAttribute('onclick'),
          ids: rows.slice(1, 3).map(d => [...d.children].map(b => b.id).join(',')),
          var1: [...document.querySelectorAll('#var-btns-row > button')].map(b => b.innerText).join(',') }; }, tab);
      await T('K', tab + ' 7 rows text', () => chk(k.rows.join('|') === Object.values(EXP).join('|'), k.rows));
      await T('K', tab + ' cols 6,6,5,5,5,5,5', () => chk(k.cols.join() === '6,6,5,5,5,5,5', k.cols));
      await T('K', tab + ' row3[0] is frac, long-press ids', () => chk(k.frac === "append('frac(')" && k.ids[0] === ',key-sqrt,key-sq,key-ln,,' && k.ids[1] === 'key-sin,key-cos,key-tan,,', k));
      await T('K', tab + ' row1 a b c x y z 物理常数', () => chk(k.var1 === 'a,b,c,x,y,z,物理常数', k.var1));
    }
    await T('K', 'old elements gone', async () => { const g = await p.evaluate(() => ({
      pair: document.querySelectorAll('.kb-pair').length, logb: !!document.getElementById('key-logb'),
      pow: document.querySelectorAll('#keyboard-area button[onclick="append(\'^{}\')"]').length,
      lg: document.querySelectorAll('#keyboard-area button[onclick="append(\'log10(\')"]').length,
      dl: document.querySelectorAll('[data-long]').length, pop: document.querySelectorAll('.key-pop,.kp-item').length,
      alt: document.querySelectorAll('.show-alt').length + (document.documentElement.outerHTML.includes('show-alt') ? 1 : 0) }));
      return chk(!g.pair && !g.logb && !g.pow && !g.lg && !g.dl && !g.pop && !g.alt, g); });

    // ---- L: long-press bubbles (9 options + hover switch), 6 short taps, blank release, move cancel ----
    const LP = [
      ['√ -> ∛ cbrt(27)=3', 'key-sqrt', 0, [], ['2', '7'], 'cbrt((27))', 3, 2],
      ['√ -> ⁿ√ nthRoot(32,5)=2', 'key-sqrt', 1, [], ['3', '2', 'R', '5'], 'nthRoot((32),(5))', 2, 2],
      ['x² -> x³ 2^3=8', 'key-sq', 0, ['2'], [], null, 8, 2],
      ['x² -> xʸ 2^5=32', 'key-sq', 1, ['2'], ['5'], null, 32, 2],
      ['ln -> lg lg(100)=2', 'key-ln', 0, [], ['1', '0', '0'], 'log10(100)', 2, 2],
      ['ln -> log_x(y) log(8,2)=3', 'key-ln', 1, [], ['8', 'R', '2'], 'log((8),(2))', 3, 2],
      ['sin -> asin(1)', 'key-sin', 0, [], ['1'], 'asin(1)', Math.asin(1), 1],
      ['cos -> acos(0.5)', 'key-cos', 0, [], ['0', '.', '5'], 'acos(0.5)', Math.acos(0.5), 1],
      ['tan -> atan(1)', 'key-tan', 0, [], ['1'], 'atan(1)', Math.atan(1), 1],
    ];
    for (const [name, id, pick, pre, post, ser, val, n] of LP) await T('L', 'long ' + name, async () => {
      await prep(p, pre); const r = await longPress(p, id, pick); await feed(p, post); const s = await st(p);
      return chk(geomOk(r, n) && (!ser || s.ser === ser) && near(num(s.res), val), { s, b: r.b, btnH: r.btnH, gone: r.gone }); });
    await T('L', 'long √ hover ∛ then ⁿ√, release on ⁿ√', async () => {
      await prep(p, []); const r = await longPress(p, 'key-sqrt', 1, 0); await feed(p, ['8', 'R', '3']); const s = await st(p);
      return chk(r.gone && s.ser === 'nthRoot((8),(3))' && near(num(s.res), 2), s); });
    const SH = [['√ sqrt(16)=4', 'key-sqrt', [], ['1', '6'], 4], ['x² 3²=9', 'key-sq', ['3'], [], 9], ['ln log(e)=1', 'key-ln', [], ['e'], 1],
      ['sin(0)=0', 'key-sin', [], ['0'], 0], ['cos(0)=1', 'key-cos', [], ['0'], 1], ['tan(0)=0', 'key-tan', [], ['0'], 0]];
    for (const [name, id, pre, post, val] of SH) await T('L', 'short ' + name, async () => {
      await prep(p, pre); await tap(p, id); const noB = (await bubble(p)) === null; await feed(p, post); const s = await st(p);
      return chk(noB && near(num(s.res), val), s); });
    await T('L', 'long √, release on blank -> no input', async () => {
      await prep(p, ['5']); const r = await longPress(p, 'key-sqrt', 'blank'); const s = await st(p); return chk(r.gone && s.ser === '5', s); });
    await T('L', 'move >8px before 450ms cancels (no bubble, no input)', async () => {
      await prep(p, ['5']); const c = await center(p, '#key-ln'); await p.mouse.move(c.x, c.y); await p.mouse.down();
      await p.mouse.move(c.x + 20, c.y, { steps: 3 }); await p.waitForTimeout(500); const b = await bubble(p);
      await p.mouse.up(); await p.waitForTimeout(40); const s = await st(p); return chk(b === null && s.ser === '5', { b, s }); });

    // ---- C: new nodes compute ----
    const NC = [['cbrt(27)=3', ['cbrt(', '2', '7'], 3], ['nthRoot(32,5)=2', ['nroot(', '3', '2', 'R', '5'], 2],
      ['2^3=8', ['2', '^{}', '3'], 8], ['lg(100)=2', ['lg(', '1', '0', '0'], 2]];
    for (const [name, seq, val] of NC) await T('C', name, async () => { await prep(p, []); await feed(p, seq); const s = await st(p); return chk(near(num(s.res), val), s); });
    await T('C', 'tex: \\sqrt[3]{} and \\sqrt[n]{}', () => p.evaluate(() => { const k = EditorCore.activeEditorKey(); const out = [];
      for (const s of [['cbrt(', '8'], ['nroot(', '8', 'R', '3']]) { switchMode('main'); clearAll(); s.forEach(x => x === 'R' ? moveCursor(1) : append(x)); out.push(EditorCore.renderTex(k, { cursor: false })); }
      return { ok: out[0] === '\\sqrt[3]{8}' && out[1] === '\\sqrt[3]{8}', info: out }; }));

    // ---- A: anchors, spacing, touch tap ----
    await T('A', '86835 anchors zero width, compact spacing', () => p.evaluate(() => { switchMode('main'); clearAll(); '86835'.split('').forEach(append);
      const d = document.getElementById('single-line-display'); const as = [...d.querySelectorAll('.ec-anchor')].map(a => a.getBoundingClientRect()); const w = as.map(r => r.width);
      const ref = document.createElement('span'); ref.style.cssText = 'position:absolute;left:0;top:0;font-size:' + getComputedStyle(d).fontSize; document.body.appendChild(ref);
      katex.render('86835', ref); const rw = (ref.querySelector('.katex-html') || ref).getBoundingClientRect().width; ref.remove();
      const dw = as[5].left - as[0].left;   // anchor 0 .. anchor 5 spans the 5 digits
      return { ok: w.length === 6 && w.every(x => x <= 0.5) && Math.abs(dw - rw) <= 0.5, info: { w, dw, rw } }; }));
    await T('A', 'tap 6 x positions -> cursor 0..5', async () => {
      await p.evaluate(() => { switchMode('main'); clearAll(); '86835'.split('').forEach(append); });
      const pts = await p.evaluate(() => { const d = document.getElementById('single-line-display');
        return [...d.querySelectorAll('.ec-anchor')].map(a => { const r = a.closest('[id^="ec-"]').getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: d.getBoundingClientRect().top + d.getBoundingClientRect().height / 2 }; }); });
      const got = [];
      for (let i = 0; i < pts.length; i++) { await p.mouse.move(pts[i].x, pts[i].y); await p.mouse.down(); await p.waitForTimeout(40); await p.mouse.up(); await p.waitForTimeout(30);
        got.push(await p.evaluate(() => EditorCore.cursorPath(EditorCore.ed(EditorCore.activeEditorKey())))); }
      return chk(got.join() === 'root:0,root:1,root:2,root:3,root:4,root:5', got); });

    // ---- U: user-select ----
    await T('U', 'display/keyboard none, inputs text', () => p.evaluate(() => { switchMode('main'); const us = e => e ? getComputedStyle(e).userSelect : 'MISSING';
      const a = [document.querySelector('.screen'), document.getElementById('single-line-display'), document.querySelector('#keyboard-area button'), document.querySelector('#var-btns-row button')].map(us);
      switchMode('matrix'); setMatrixTarget('def'); const mc = document.querySelector('.matrix-cell'); const b = [us(document.getElementById('rootX1')), us(mc)];
      setMatrixTarget('calc'); switchMode('main');
      return { ok: a.every(x => x === 'none') && b.every(x => x === 'text'), info: { a, b } }; }));

    // ---- F: fonts ----
    await T('F', 'fonts.check KaTeX_Main/Math/Size1/Size2', () => p.evaluate(() => { const f = ['KaTeX_Main', 'KaTeX_Math', 'KaTeX_Size1', 'KaTeX_Size2'].map(x => document.fonts.check('20px ' + x)); return { ok: f.every(Boolean), info: f }; }));
    const glyph = await p.evaluate(() => { switchMode('main');
      const tw = n => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().width; };
      const txt = (root, ch) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue === ch) return n; return null; };
      const kb = [...document.querySelectorAll('#keyboard-area button')];
      const src = { '8': [kb.find(b => b.innerText.trim() === '8'), '8'], x: [kb.find(b => b.innerText.replace(/\s/g, '') === 'd/dx'), 'x'],
        'π': [kb.find(b => b.innerText.trim() === 'π'), '\\pi'], '∫': [kb.find(b => b.innerText.trim() === '∫'), '\\displaystyle\\int'] };
      const out = {};
      for (const ch in src) { const [btn, tex] = src[ch]; const bn = btn && txt(btn, ch); if (!bn) { out[ch] = 'no button text'; continue; }
        const bcs = getComputedStyle(bn.parentElement); const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:0;top:0;font-size:20px'; document.body.appendChild(box);
        katex.render(tex, box); const kn = txt(box.querySelector('.katex-html'), ch === '∫' ? '∫' : ch); const kcs = getComputedStyle(kn.parentElement);
        const kw = tw(kn) * parseFloat(bcs.fontSize) / parseFloat(kcs.fontSize); const bw = tw(bn); box.remove();
        out[ch] = { bw: +bw.toFixed(3), kw: +kw.toFixed(3), d: +Math.abs(bw - kw).toFixed(3), bf: bcs.fontFamily.split(',')[0], kf: kcs.fontFamily.split(',')[0] }; }
      return out; });
    for (const ch of ['8', 'x', 'π', '∫']) await T('F', 'glyph width button vs KaTeX: ' + ch, () => chk(glyph[ch] && glyph[ch].d <= 0.1, glyph[ch]));
    NUM.glyph = glyph;

    // ---- I: integral-equation mode removed, algebraic roots work ----
    await T('I', 'inteq elements/global absent', () => p.evaluate(() => { const ids = ['root-mode-inteq', 'root-mode-alg', 'root-btn-inteq', 'inteqLower', 'inteqUpper', 'inteqC', 'inteq-inputs'];
      const left = ids.filter(i => document.getElementById(i)); return { ok: !left.length && typeof InteqSolver === 'undefined' && !!document.getElementById('root-btn-alg'), info: { left, g: typeof InteqSolver } }; }));
    await T('I', 'algebraic roots x^2-4 -> ±2', async () => {
      await p.evaluate(() => { switchMode('funcs'); setFuncTarget('f'); clearAll(); append('x'); append('^{2}'); append('-'); append('4'); calculate(); switchMode('roots'); });
      await p.click('#root-target-f'); await p.fill('#rootX1', '-10'); await p.fill('#rootX2', '10'); await p.click('#root-btn-alg');
      await p.waitForFunction(() => document.querySelectorAll('#root-list annotation').length > 0 || /错误|未定义/.test(document.getElementById('root-list').innerText), null, { timeout: 15000 });
      const ar = await p.evaluate(() => [...document.querySelectorAll('#root-list annotation')].map(a => a.textContent));
      const v = ar.map(s => parseFloat(s.split('=').pop())).sort((a, b) => a - b);
      return chk(v.length === 2 && near(v[0], -2, 1e-6) && near(v[1], 2, 1e-6), ar); });

    // ---- V: variable t removed ----
    await T('V', 'no #var-row-t, VAR_KEYS/varVals without t', () => p.evaluate(() => ({ ok: !document.getElementById('var-row-t') && !VAR_KEYS.includes('t') && !('t' in varVals) && !getCombinedScope().has('t'), info: VAR_KEYS })));
    await T('V', 'a=2 then a*3 = 6', async () => {
      await p.evaluate(() => switchMode('vars')); await p.click('#var-row-a');
      await p.evaluate(() => { clearAll(); append('2'); calculate(); switchMode('main'); clearAll(); append('a'); append('*'); append('3'); calculate(); });
      const s = await st(p); return chk(near(num(s.res), 6), s); });

    // ---- P: other panels ----
    const vis = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const c = document.querySelector('.calculator');
      return { disp: getComputedStyle(e).display, w: r.width, h: r.height, over: c.scrollHeight - c.clientHeight, kb: getComputedStyle(document.getElementById('keyboard-area')).display }; }, sel);
    for (const [name, setup, sel, minH] of [['plot', "switchMode('plot')", '#plotCanvas', 100], ['fit data', "switchMode('fit');setFitTarget('data')", '#fit-data-panel', 100],
      ['fit graph', "switchMode('fit');setFitTarget('graph')", '#fit-graph-panel', 100], ['fit stats', "switchMode('fit');setFitTarget('stats')", '#fit-stats-panel', 100],
      ['matrix calc', "switchMode('matrix');setMatrixTarget('calc')", '#matrix-panel', 100], ['matrix def', "switchMode('matrix');setMatrixTarget('def')", '#matrix-grid', 20],
      ['roots', "switchMode('roots')", '#roots-panel', 50]])
      await T('P', name + ' visible, no overflow, keyboard hidden', async () => { await p.evaluate(s => (0, eval)(s), setup); await p.waitForTimeout(50); const v = await vis(p, sel);
        return chk(v && v.disp !== 'none' && v.w > 200 && v.h >= minH && v.over <= 0 && v.kb === 'none', v); });
    await T('P', 'const panel open/close', async () => { await p.evaluate(() => { switchMode('main'); setFitTarget('data'); setMatrixTarget('calc'); }); await p.click('#btn-const');
      const v = await vis(p, '#const-panel'); const cells = await p.evaluate(() => document.querySelectorAll('#const-panel .const-cell').length);
      await p.click('#btn-const'); const k = await p.evaluate(() => getComputedStyle(document.getElementById('keyboard-area')).display);
      return chk(v.disp === 'flex' && v.h > 100 && v.over <= 0 && v.kb === 'none' && cells > 10 && k === 'flex', { v, cells, k }); });
    await p.close();

    // ---- S: sizes, 4 viewports x 3 tabs ----
    NUM.size = {};
    for (const [w, h] of [[420, 860], [393, 851], [360, 740], [360, 640]]) {
      const q = await newPage(browser, w, h, errs);
      for (const tab of ['vars', 'main', 'funcs']) {
        const m = await q.evaluate(async tab => { switchMode(tab); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const kb = document.getElementById('keyboard-area'); const rows = [...kb.children]; const rr = e => e.getBoundingClientRect();
          const sq = i => [...rows[i].children].map(b => Math.abs(rr(b).width - rr(b).height));
          const cell = rr(rows[1].children[0]).width; const r4 = [...rows[2].children].map(rr); const gap = parseFloat(getComputedStyle(rows[2]).columnGap);
          const c = document.querySelector('.calculator'); const de = document.documentElement;
          return { sq23: Math.max(...sq(0), ...sq(1)), sqNum: Math.max(...sq(3), ...sq(4), ...sq(5), ...sq(6)), cell, r4h: Math.max(...r4.map(r => Math.abs(r.height - cell))),
            r4w: Math.abs(r4.reduce((s, r) => s + r.width, 0) + 4 * gap - rr(rows[2]).width), kbW: rr(kb).width, kbH: rr(kb).height,
            v1: [...document.querySelectorAll('#var-btns-row > button')].map(b => rr(b).height),
            over: Math.max(c.scrollHeight - c.clientHeight, de.scrollHeight - de.clientHeight), screen: rr(document.getElementById('main-screen')).height }; }, tab);
        NUM.size[w + 'x' + h + ' ' + tab] = { cell: +m.cell.toFixed(2), kbW: +m.kbW.toFixed(1), kbH: +m.kbH.toFixed(1), screen: +m.screen.toFixed(1), over: m.over };
        await T('S', `${w}x${h} ${tab} geometry`, () => chk(m.sq23 <= 1 && m.sqNum <= 1 && m.r4h <= 1 && m.r4w <= 1 && m.v1.every(x => Math.abs(x - 26) <= 0.5) && m.over <= 0 && m.screen > 0, m));
      }
      await q.close();
    }
    await T('E', 'no page errors', () => chk(errs.length === 0, errs.slice(0, 3)));
  } catch (e) { R.push({ sec: 'X', name: 'suite crashed', pass: false, info: String(e && e.message || e) }); }
  finally { await browser.close().catch(() => {}); }
  for (const s of [...new Set(R.map(r => r.sec))]) { const r = R.filter(x => x.sec === s); console.log(`section ${s}: ${r.filter(x => x.pass).length}/${r.length}`); }
  if (process.argv.includes('--num')) console.log(JSON.stringify(NUM, null, 0));
  const f = R.filter(x => !x.pass);
  f.forEach(x => console.log(`FAIL [${x.sec}] ${x.name} ${x.info}`));
  if (process.argv.includes('--list')) R.forEach(x => console.log(`${x.pass ? 'ok ' : 'NO '} ${x.sec} ${x.name}`));
  console.log(`TOTAL ${R.length - f.length}/${R.length} pass, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(f.length ? 1 : 0);
})();