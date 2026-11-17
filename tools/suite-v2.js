// WebCASIO v2 regression suite (I5). Self-contained: loads page via ./harness.js (repo copy).
// Ported + merged from former %TEMP%\webcasio-test\ i2.js / i3.js / i4.js / i4b.js, plus new cases.
// Needs playwright-core (NOT a repo dependency). Resolution order: normal require, then
//   %PW_NODE_MODULES%, then %TEMP%\webcasio-test\node_modules (where it was installed for I1-I4b).
// Browser: headless Microsoft Edge at C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe.
// Run:  node tools\suite-v2.js            (add -v to print ported scripts' own logs)
//       set CALC=<path to index.html> to test another copy.
// Timing: long-press / tap cases use Playwright page.clock (fake timers), as the original scripts did.
// Categories: legal = valid expression, numeric expectation computed independently (Node Math / analytic);
//             error = deliberately invalid input, expected error message;
//             ui    = UI / editor behaviour (inserted text, geometry, scroll, cursor);
//             path  = pass-through checks sharing data/objects with code under test (not independent).
'use strict';
const path = require('path'); const Module = require('module');
try { require.resolve('playwright-core'); } catch (e) {
  process.env.NODE_PATH = [process.env.NODE_PATH, process.env.PW_NODE_MODULES,
    path.join(process.env.TEMP || '', 'webcasio-test', 'node_modules')].filter(Boolean).join(path.delimiter);
  Module._initPaths();
}
const { open, press } = require('./harness.js');
const VERBOSE = process.argv.includes('-v');
const RESULTS = [];
function rec(section, cat, name, cond, info) {
  RESULTS.push({ section, cat, name: String(name), pass: !!cond, info: cond ? '' : JSON.stringify(info === undefined ? '' : info).slice(0, 160) });
}
const quietConsole = { log: (...a) => { if (VERBOSE) console.log('   |', ...a); }, error: (...a) => console.error(...a) };
const near = (got, exp, tol) => Number.isFinite(got) && Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp));
const resNum = s => { const m = /=\s*(-?[0-9.]+(?:e[+-]?\d+)?)/i.exec(s || ''); return m ? parseFloat(m[1]) : NaN; };

// ---------------- Section N: new cases written for I5 ----------------
async function sectionNew() {
  const o = await open();
  try { await sectionNewBody(o); } finally { await o.browser.close().catch(() => {}); }
}
async function sectionNewBody({ browser, page, errors }) {
  const S = 'new';
  await page.clock.install();
  const oc = s => `#keyboard-area button[onclick="${s}"]`;
  const K = { '+': oc("append('+')"), '*': oc("append('*')"), '/': oc("append('/')"), '.': oc("append('.')"),
    '(': oc("append('(')"), ')': oc("append(')')"), L: oc('moveCursor(-1)'), R: oc('moveCursor(1)'), '=': oc('calculate()'),
    f: oc("append('f(')"), g: oc("append('g(')"), INT: oc("append('int(')"), DER: oc("append('deriv(')"), x: oc("append('x')"),
    FRAC: oc("append('frac(')"), SQRT: oc("append('sqrt(')"), POW: oc("append('^{}')"), SQ: oc("append('^{2}')"),
    LOGB: '#key-logb', SIN: '#key-sin', COS: '#key-cos', TAN: '#key-tan', PI: oc("append('pi')"), E: oc("append('e')") };
  for (const d of '0123456789') K[d] = oc(`append('${d}')`);
  const ctr = sel => page.evaluate(sel => {
    const b = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null && e.getBoundingClientRect().width > 0);
    if (!b) return null; const q = b.getBoundingClientRect(); const x = q.left + q.width / 2, y = q.top + q.height / 2;
    const hit = document.elementFromPoint(x, y); return { x, y, w: q.width, hit: !!hit && (hit === b || b.contains(hit)) };
  }, sel);
  const at = async sel => { const p = await ctr(sel); if (!p || !p.hit) throw new Error('not tappable: ' + sel); return p; };
  const tap = async tok => { const p = await at(K[tok] || tok); await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.clock.runFor(60); await page.mouse.up(); await page.clock.runFor(20); };
  const hold = async (tok, ms, target) => { const p = await at(K[tok] || tok); await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.clock.runFor(ms);
    if (target === 'outside') await page.mouse.move(5, 5, { steps: 4 });
    else if (target) { const q = await ctr(target); if (q) await page.mouse.move(q.x, q.y, { steps: 4 }); }
    await page.mouse.up(); await page.clock.runFor(50); };
  const st = () => page.evaluate(() => { const k = EditorCore.activeEditorKey();
    return { ser: EditorCore.serialize(k), tex: EditorCore.renderTex(k, { cursor: false }), res: document.getElementById('calc-res-val').innerText }; });
  const reset = () => page.evaluate(() => { switchMode('main'); clearAll(); });
  const seq = async toks => { await reset(); for (const t of toks) await tap(t); return st(); };
  const legal = async (name, toks, exp, tol = 1e-8) => { const s = await seq(toks); const g = resNum(s.res); rec(S, 'legal', name, near(g, exp, tol), s); return s; };
  const bad = async (name, toks, extra) => { const s = await seq(toks); rec(S, 'error', name, s.res.includes('语法错误') && (!extra || extra(s)), s); return s; };
  const toks = s => s.split(' ');

  // stray right parenthesis (xclose)
  await legal('xclose (1+2)=3', toks('( 1 + 2 ) ='), 1 + 2);
  await legal('xclose sin(0) with typed )', toks('SIN 0 ) ='), Math.sin(0));
  await legal('xclose (2*(3+4))=14', toks('( 2 * ( 3 + 4 ) ) ='), 2 * (3 + 4));
  await legal('xclose ((1))=1', toks('( ( 1 ) ) ='), 1);
  await legal('xclose 2*(3)=6', toks('2 * ( 3 ) ='), 6);
  await bad('xclose sqrt(8) then )', toks('SQRT 8 ) ='), s => s.tex.includes('\\sqrt{8)}'));
  await bad('xclose ) on empty', toks(') ='));
  await bad('xclose 1+2)', toks('1 + 2 ) ='));
  await bad('xclose ((1)))', toks('( ( 1 ) ) ) ='));
  await bad('xclose 2)*3', toks('2 ) * 3 ='));

  // every new key at least once
  await page.evaluate(() => { switchMode('funcs'); setFuncTarget('f'); clearAll(); });
  for (const t of toks('x * 2')) await tap(t);
  await page.evaluate(() => { switchMode('funcs'); setFuncTarget('g'); clearAll(); });
  for (const t of toks('x + 1')) await tap(t);
  const defs = await page.evaluate(() => [state.expr.fx, state.expr.gx]);
  rec(S, 'ui', 'key f(x)/g(x) definitions typed', defs[0] === 'x*2' && defs[1] === 'x+1', defs);
  await legal('key f(x): f(3) with f=x*2', toks('f 3 ) ='), 3 * 2);
  await legal('key g(x): g(4) with g=x+1', toks('g 4 ) ='), 4 + 1);
  await legal('key ∫: ∫_0^2 x dx', toks('INT x R 0 R 2 ='), 2 * 2 / 2);
  await legal('key d/dx: d/dx x^2 at 3', toks('DER x POW 2 R R 3 ='), 2 * 3, 1e-6);
  await legal('key ←: 12 ← 3 = 132', toks('1 2 L 3 ='), 132);
  await legal('key →: sqrt(4) → +1 = 3', toks('SQRT 4 R + 1 ='), Math.sqrt(4) + 1);
  { const s = await seq(['x']); rec(S, 'ui', 'key x inserts x', s.ser === 'x', s); }
  await legal('key 分数线: 1/4', toks('FRAC 1 R 4 ='), 1 / 4);
  await legal('key √: sqrt(9)', toks('SQRT 9 ='), 3);
  await legal('key x^y: 2^10', toks('2 POW 1 0 ='), Math.pow(2, 10));
  await legal('key x²: 3²', toks('3 SQ ='), 9);
  await legal('key log_x(y): log_10(1000)', toks('LOGB 1 0 0 0 R 1 0 ='), Math.log(1000) / Math.log(10), 1e-9);
  await legal('key sin: sin(0)', toks('SIN 0 ='), 0);
  await legal('key cos: cos(0)', toks('COS 0 ='), Math.cos(0));
  await legal('key tan: tan(0)', toks('TAN 0 ='), Math.tan(0));
  await legal('key π', toks('PI ='), Math.PI, 1e-9);
  await legal('key e', toks('E ='), Math.E, 1e-9);
  await legal('key ( ): (2+3)*2', toks('( 2 + 3 ) * 2 ='), 10);

  // long-press branches sin/cos/tan (short tap, long press + release)
  for (const k of ['sin', 'cos', 'tan']) {
    await reset(); await hold(k.toUpperCase(), 60); let s = await st();
    rec(S, 'ui', `${k} short -> ${k}(`, s.ser.startsWith(k + '(') , s);
    await reset(); await hold(k.toUpperCase(), 500); s = await st();
    rec(S, 'ui', `${k} long -> a${k}(`, s.ser.startsWith('a' + k + '('), s);
  }
  // half-width parentheses
  { const w = await page.evaluate(() => { const vis = s => [...document.querySelectorAll(s)].find(e => e.offsetParent !== null);
      return [vis(`#keyboard-area button[onclick="append('(')"]`), vis(`#keyboard-area button[onclick="append(')')"]`), vis('#key-sin')].map(b => b.getBoundingClientRect().width); });
    const r1 = w[0] / w[2], r2 = w[1] / w[2];
    rec(S, 'ui', `half-width ( ratio ${r1.toFixed(3)}`, r1 >= 0.40 && r1 <= 0.60, w);
    rec(S, 'ui', `half-width ) ratio ${r2.toFixed(3)}`, r2 >= 0.40 && r2 <= 0.60, w); }

  // numeric end-to-end (independent oracles)
  await reset(); await hold('SIN', 500); for (const t of toks('0 . 5 ) =')) await tap(t);
  { const s = await st(); rec(S, 'legal', 'asin(0.5) = π/6', near(resNum(s.res), Math.PI / 6, 1e-8), s); }
  await reset(); await hold('COS', 500); for (const t of toks('0 . 5 ) =')) await tap(t);
  { const s = await st(); rec(S, 'legal', 'acos(0.5) = π/3', near(resNum(s.res), Math.PI / 3, 1e-8), s); }
  await reset(); await hold('TAN', 500); for (const t of toks('1 ) =')) await tap(t);
  { const s = await st(); rec(S, 'legal', 'atan(1) = π/4', near(resNum(s.res), Math.PI / 4, 1e-8), s); }
  await legal('log_2(8) = 3', toks('LOGB 8 R 2 ='), 3, 1e-9);
  await reset(); await hold('LOGB', 460, '.kp-item[data-ins="log("]'); for (const t of toks('E ) =')) await tap(t);
  { const s = await st(); rec(S, 'legal', 'long-press ln: ln(e) = 1', near(resNum(s.res), 1, 1e-9), s); }

  rec(S, 'ui', 'new section pageErrors=0', errors.length === 0, errors.slice(0, 2));
}

// ---------------- Ported sections (bodies of former TEMP i2/i3/i4/i4b scripts) ----------------
// Changes vs. originals: require line removed; ok() also records into RESULTS; console is muted unless -v;
// process.exit() becomes a thrown error; open() is tracked so browsers close on failure.
async function port_i2(open, press, __rec) {
  const console = quietConsole; const process = { env: global.process.env, exit(c) { throw new Error('i2 exit ' + c); } };
  return (async()=>{const {browser,page,errors}=await open();const out=[];const ok=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n);__rec(n,c,i);};
await page.clock.install();
const st=()=>page.evaluate(()=>{const k=EditorCore.activeEditorKey();return {ser:EditorCore.serialize?EditorCore.serialize(k):null,tex:EditorCore.renderTex(k,{cursor:false})};});
const reset=m=>page.evaluate(m=>{switchMode(m);clearAll();},m);
const ctr=async sel=>{const r=await page.evaluate(sel=>{const b=document.querySelector(sel);const q=b.getBoundingClientRect();const x=q.left+q.width/2,y=q.top+q.height/2;const hit=document.elementFromPoint(x,y);return {x,y,vis:b.offsetParent!==null&&q.width>0,hit:!!hit&&(hit===b||b.contains(hit))};},sel);if(!r.vis||!r.hit)throw new Error('not clickable '+sel);return r;};
const tap=async sel=>{const p=await ctr(sel);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.clock.runFor(60);await page.mouse.up();};
const hold=async(sel,ms,dx=0,target=null)=>{const p=await ctr(sel);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.clock.runFor(ms);
 if(dx)await page.mouse.move(p.x+dx,p.y,{steps:3});
 if(target){const q=await page.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},target);if(!q){await page.mouse.up();return 'nopop';}await page.mouse.move(q.x,q.y,{steps:4});}
 await page.mouse.up();};
const oc=v=>`#keyboard-area button[onclick="${v}"]`;
// 1-3 layout
for(const m of ['main','funcs','vars']){await reset(m);const L=await page.evaluate(()=>{const kb=document.getElementById('keyboard-area');const rows=[...kb.children];return rows.map(r=>{const cells=[...r.children].map(c=>{const q=c.getBoundingClientRect();return {w:+q.width.toFixed(2),t:+q.top.toFixed(2),vis:c.offsetParent!==null&&q.width>0&&q.height>0}});const pr=r.classList.contains('kb-row-6')&&r.querySelector('.kb-pair')?[...r.querySelectorAll('.kb-pair>button')].map(b=>+b.getBoundingClientRect().width.toFixed(2)):null;return {cls:r.className,n:cells.length,cells,pr,h:+r.getBoundingClientRect().height.toFixed(1)};});});
 const six=L.slice(0,3),five=L.slice(3);
 ok(m+' rows2-4 6 visible',six.every(r=>r.cls==='kb-row-6'&&r.n===6&&r.cells.every(c=>c.vis)),six.map(r=>r.n));
 ok(m+' same top',L.every(r=>r.cells.every(c=>Math.abs(c.t-r.cells[0].t)<0.5)),0);
 const ws=six.flatMap(r=>r.cells.map(c=>c.w));ok(m+' 1-cell width diff<=1',Math.max(...ws)-Math.min(...ws)<=1,ws);
 const pr=six[2].pr,cw=six[2].cells[0].w;ok(m+' paren ratio',pr.length===2&&pr.every(w=>w/cw>=0.4&&w/cw<=0.6),{pr,cw});
 ok(m+' numpad 4x5',five.length===4&&five.every(r=>r.cls==='kb-row-5'&&r.n===5&&r.cells.every(c=>c.vis)),five.map(r=>r.n));
 if(m==='main')console.log('widths cell',cw,'paren',pr,'ratio',(pr[0]/cw).toFixed(3),'num',five[0].cells[0].w,'rowH',L.map(r=>r.h).join(','));}
for(const m of ['plot','roots','fit','matrix']){const d=await page.evaluate(m=>{switchMode(m);return getComputedStyle(document.getElementById('keyboard-area')).display;},m);ok(m+' kb hidden',d==='none',d);}
// 4 trig
const cases=[['sin',60,0,'sin('],['sin',500,0,'asin('],['sin',500,12,''],['sin',100,12,''],['sin',449,0,'sin('],['sin',451,0,'asin('],['cos',60,0,'cos('],['cos',500,0,'acos('],['tan',60,0,'tan('],['tan',500,0,'atan(']];
for(const [k,ms,dx,exp] of cases){await reset('main');await hold('#key-'+k,ms,dx);const s=await st();const want=exp?s.ser.startsWith(exp.replace('(','')):s.ser==='';ok(`${k} ${ms}ms dx${dx}`,want&&(exp?!(!exp.startsWith('a')&&s.ser.startsWith('a')):true),s);}
// long-press preview visible during hold
await reset('main');{const p=await ctr('#key-sin');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.clock.runFor(460);const v=await page.evaluate(()=>{const b=document.getElementById('key-sin');return {cls:b.classList.contains('show-alt'),txt:b.innerText,h:b.getBoundingClientRect().height};});await page.mouse.up();ok('sin preview sin⁻¹',v.cls&&v.txt.trim()==='sin⁻¹',v);}
// 5 logb
await reset('main');await tap('#key-logb');let s=await st();ok('logb short',/^log\(\(.*\),\(.*\)\)$/.test(s.ser),s);
await reset('main');{const p=await ctr('#key-logb');const kb0=await page.evaluate(()=>document.getElementById('keyboard-area').getBoundingClientRect().height);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.clock.runFor(460);
 const pp=await page.evaluate(()=>{const e=document.querySelector('.key-pop');if(!e)return null;const r=e.getBoundingClientRect(),its=[...e.querySelectorAll('.kp-item')].map(i=>{const q=i.getBoundingClientRect();const h=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return {t:i.innerText,vis:q.width>0,hit:h===i}});return {pos:getComputedStyle(e).position,its,kb:document.getElementById('keyboard-area').getBoundingClientRect().height,top:r.top};});
 await page.mouse.up();ok('pop absolute, no layout change, items hittable',pp&&pp.pos==='absolute'&&Math.abs(pp.kb-kb0)<0.5&&pp.its.length===2&&pp.its.every(i=>i.vis&&i.hit)&&pp.top>=0,pp);}
await reset('main');let r=await hold('#key-logb',460,0,'.kp-item[data-ins="log("]');s=await st();ok('logb long->ln',s.ser.startsWith('log(')&&!s.ser.startsWith('log(('),{r,s});
await tap('#keyboard-area button[onclick="append(\'e\')"]');await tap('.kb-pair button:last-child');await tap(oc('calculate()'));let res=await page.evaluate(()=>document.getElementById('calc-res-val').innerText);ok('ln(e)=1',res==='= 1',res);
await reset('main');await hold('#key-logb',460,0,'.kp-item[data-ins="t"]');s=await st();ok('logb long->t',s.ser==='t',s);
await reset('main');{const p=await ctr('#key-logb');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.clock.runFor(460);await page.mouse.move(p.x-150,p.y+40,{steps:4});await page.mouse.up();s=await st();ok('logb long outside->none',s.ser===''&&!(await page.$('.key-pop')),s);}
// 6 e2e
await reset('main');await tap('#key-logb');await tap(oc("append('8')"));await tap(oc('moveCursor(1)'));await tap(oc("append('2')"));s=await st();await tap(oc('calculate()'));res=await page.evaluate(()=>document.getElementById('calc-res-val').innerText);ok('log_2(8)=3',res==='= 3',{s,res});
await reset('main');await hold('#key-sin',500);for(const k of ['0','.','5'])await tap(oc(`append('${k}')`));await tap('.kb-pair button:last-child');await tap(oc('calculate()'));res=await page.evaluate(()=>document.getElementById('calc-res-val').innerText);ok('asin(0.5)~0.5236',/0\.5235|0\.5236/.test(res),res);
// keyboard activation
await reset('main');await page.focus('#key-cos');await page.keyboard.press('Space');s=await st();ok('cos keyboard Space->cos(',s.ser.startsWith('cos(')&&!s.ser.startsWith('acos'),s);
const lg=await page.evaluate(()=>[...document.querySelectorAll('#keyboard-area button')].filter(b=>/log10|log\('\)/.test(b.getAttribute('onclick')||'')).length);ok('lg/ln buttons removed',lg===0,lg);
const f=out.filter(x=>x.startsWith('FAIL'));console.log(`PASS ${out.length-f.length}/${out.length}`);console.log(f.map(x=>x.slice(0,40)).join('\n'));console.log('pageErrors',errors.length,errors.slice(0,2).join('|').slice(0,200));await browser.close();})().catch(e=>{console.log('ERR',String(e).slice(0,300));process.exit(1)});
}
async function port_i3(open, press, __rec) {
  const console = quietConsole; const process = { env: global.process.env, exit(c) { throw new Error('i3 exit ' + c); } };
  return (async()=>{const {browser,page,errors}=await open();const out=[];const ok=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n);__rec(n,c,i);};
const m=()=>page.evaluate(()=>{const d=document.getElementById('single-line-display');const c=d.querySelector('.cursor-blink')||d.querySelector('.base-missing');const cr=d.getBoundingClientRect();const r=c?c.getBoundingClientRect():null;
 return {sl:d.scrollLeft,sw:d.scrollWidth,cw:d.clientWidth,cl:r?r.left-cr.left+d.scrollLeft:null,cr:r?r.right-cr.left+d.scrollLeft:null};});
const vis=x=>x.cr!==null&&x.sl+x.cw+1>=x.cr&&x.sl<=x.cl+1&&x.sl<=x.sw-x.cw+1&&x.sl>=0;
await page.evaluate(()=>{switchMode('main');clearAll();});
let x=await m();ok('empty sl=0',x.sl===0,x);
await page.evaluate(()=>{append('1');append('+');append('2');});x=await m();ok('short sl=0',x.sl===0&&x.sw<=x.cw,x);
await page.evaluate(()=>clearAll());const reps=[];
for(let i=1;i<=40;i++){await page.evaluate(i=>{append(String(i%10));append('+');},i);if(i%10===0){x=await m();reps.push(x);ok('long '+i+' visible',vis(x),x);}}
ok('long overflows',reps[3].sw>reps[3].cw,reps[3]);
for(let i=0;i<80;i++)await page.evaluate(()=>moveCursor(-1));x=await m();ok('home visible',vis(x)&&x.sl<=24,x);const home=x;
for(let i=0;i<80;i++)await page.evaluate(()=>moveCursor(1));x=await m();ok('end visible',vis(x),x);
await page.evaluate(()=>{window.__ec_autoscroll_enabled=false;document.getElementById('single-line-display').scrollLeft=37;});
for(let i=0;i<5;i++)await page.evaluate(()=>{append('7');append('+');});x=await m();ok('append restores autoscroll',x.sl!==37&&vis(x),x);
await page.evaluate(()=>{window.__ec_autoscroll_enabled=true;append('8');});x=await m();ok('re-enabled follows',vis(x),x);
// tap real keys once
await page.evaluate(()=>{clearAll();});
const ep=errors.length;await page.evaluate(()=>{switchMode('plot');});
const pl=await page.evaluate(()=>{updatePlotScreen();return ['line-fx','line-gx'].map(id=>{const e=document.getElementById(id);return {k:!!e.querySelector('.katex'),t:e.textContent.slice(0,20)};});});
ok('plot render',pl.every(p=>p.k),pl);ok('pageErrors=0',errors.length===0,errors.slice(0,3));
console.log(out.filter(s=>s.startsWith('FAIL')).slice(0,3).join('\n'));
console.log('pass',out.filter(s=>s.startsWith('PASS')).length,'/',out.length);
console.log('rep40',JSON.stringify(reps[3]),'home',JSON.stringify(home));
await browser.close();})().catch(e=>{console.log('ERR',e.message.slice(0,300));process.exit(1);});
}
async function port_i4(open, press, __rec) {
  const console = quietConsole; const process = { env: global.process.env, exit(c) { throw new Error('i4 exit ' + c); } };
  return (async()=>{const {browser,page,errors}=await open();const out=[];const ok=(n,c,i)=>{out.push((c?'PASS ':'FAIL ')+n);__rec(n,c,i);};
await page.clock.install();
await page.evaluate(()=>{window.__spc=0;const o=EditorCore.setCursorPath;EditorCore.setCursorPath=function(){window.__spc++;return o.apply(this,arguments);};});
const cur=()=>page.evaluate(()=>{const k=EditorCore.activeEditorKey();const ps=EditorCore.cursorPositions(k);const d=document.getElementById('single-line-display');const c=d.querySelector('.cursor-blink');
 return {ps,sl:d.scrollLeft,auto:window.__ec_autoscroll_enabled,spc:window.__spc,cx:c?(c.getBoundingClientRect().left+c.getBoundingClientRect().right)/2:null};});
const anchors=()=>page.evaluate(()=>[...document.querySelectorAll('#single-line-display .ec-anchor')].map(a=>a.closest('[id^="ec-"]')).map(a=>{const r=a.getBoundingClientRect();return {p:a.id.slice(3),x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,w:r.width};}));
const curPath=()=>page.evaluate(()=>EditorCore.cursorPath(EditorCore.editors[EditorCore.activeEditorKey()]));const curPathOld=()=>page.evaluate(()=>{const d=document.getElementById('single-line-display');const c=d.querySelector('.cursor-blink');const cx=c.getBoundingClientRect().left;
 let b=null,bd=1e9;d.querySelectorAll('.ec-anchor').forEach(q=>{const a=q.closest('[id^="ec-"]');const r=a.getBoundingClientRect();const dd=Math.abs((r.left+r.right)/2-cx);if(dd<bd){bd=dd;b=a.id.slice(3);}});return b;});
const tap=async(x,y,dt=100,dx=0)=>{await page.mouse.move(x,y);await page.mouse.down();await page.clock.runFor(dt);if(dx)await page.mouse.move(x+dx,y);await page.mouse.up();};
const typ=async s=>{for(const ch of s)await page.evaluate(c=>append(c),ch);};
await page.evaluate(()=>{switchMode('main');clearAll();});
// 5 empty
let A=await anchors();const d0=await page.evaluate(()=>{const r=document.getElementById('single-line-display').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,r:r.right};});
let s0=await cur();await tap(d0.x,d0.y);let s1=await cur();ok('5 empty no crash/no setCursorPath',errors.length===0&&s1.spc===s0.spc,{A:A.length,s0,s1,errors});
await typ('1+2+3+4+5+6+7+8+9');A=await anchors();ok('anchors present w>=2',A.length>=17&&A.every(a=>a.w>=1.9),{n:A.length,w:A.map(a=>a.w).slice(0,3)});
const idx=a=>A.findIndex(z=>z.p===a);
// 1 taps
let n1=0,t1=0;const vis=async i=>{await page.evaluate(i=>{const d=document.getElementById('single-line-display');const a=[...d.querySelectorAll('.ec-anchor')][i];const r=a.getBoundingClientRect(),c=d.getBoundingClientRect();if(r.left<c.left+5||r.right>c.right-5)d.scrollLeft+=r.left-c.left-c.width/2;},i);A=await anchors();};
for(const i of [0,3,8,12,A.length-1]){t1++;await vis(i);await tap(A[i].x,A[i].y,100);const p=await curPath();if(Math.abs(idx(p)-i)<=1)n1++;else ok('1 tap '+i,false,{p,want:A[i].p});}
ok('1 tap positions '+n1+'/'+t1,n1===t1,{});
// 2 thresholds
const pre=async()=>{await vis(A.length-1);await tap(A[A.length-1].x,A[A.length-1].y,100);return curPath();};
const bnd=async(name,dt,dx,expect)=>{await pre();await vis(2);const tgt=A[2];await tap(tgt.x,tgt.y,dt,dx);const p=await curPath();const hit=Math.abs(idx(p)-2)<=1;ok('2 '+name+(expect?' tap':' no-tap'),hit===expect,{p});};
await bnd('dt249',249,0,true);await bnd('dt251',251,0,false);await bnd('dx9',100,9,true);await bnd('dx11',100,11,false);
// 3 swipe: touch drag via CDP
await page.evaluate(()=>{for(let i=0;i<20;i++){append('1');append('2');append('+');}});A=await anchors();
await page.evaluate(()=>{const d=document.getElementById('single-line-display');window.__ec_autoscroll_enabled=true;d.scrollLeft=d.scrollWidth;});
let before=await cur();const pb=await curPath();
const cdp=await page.context().newCDPSession(page);const sy=d0.y;let sx=d0.x-100;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
for(let k=1;k<=10;k++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+k*15,y:sy}]});await page.clock.runFor(16);}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.clock.runFor(50);
let after=await cur();const pa=await curPath();
ok('3 swipe cursor unchanged, auto restored',pa===pb&&after.spc===before.spc&&after.auto===true,{pa,pb,after});
// fallback mouse-drag scroll check (native scroll programmatic) if touch scroll didn't move
ok('3 swipe scrollLeft changed '+before.sl+'->'+after.sl,after.sl!==before.sl,{before:before.sl,after:after.sl});
// 4 tap then = then type
await page.evaluate(()=>{clearAll();});await typ('1+2+3+4+5+6+7+8+9');A=await anchors();
await vis(4);await tap(A[4].x,A[4].y,100);const pt=await curPath();const st=await cur();ok('4 tap sets auto back true',st.auto===true,st);
const ans=await page.evaluate(()=>{calculate();return document.getElementById('result-value')?document.getElementById('result-value').innerText:resVal.innerText;});
await typ('7');const tex=await page.evaluate(()=>EditorCore.renderTex(EditorCore.activeEditorKey(),{cursor:false}));
ok('4 after = and append, insertion at '+pt,tex.replace(/\s/g,'')==='1+2+'.slice(0,+pt.split(':')[1])+'7'+'1+2+3+4+5+6+7+8+9'.slice(+pt.split(':')[1]),{tex,pt,ans});
await page.evaluate(()=>{clearAll();for(let i=0;i<30;i++){append('1');append('+');}});
await page.evaluate(()=>{document.getElementById('single-line-display').scrollLeft=0;});A=await anchors();await tap(A[1].x,A[1].y,100);
const sTap=await cur();await page.evaluate(()=>{for(let i=0;i<40;i++)moveCursor(1);});await page.evaluate(()=>append('9'));const sApp=await cur();
ok('4 tap no autoscroll, append autoscroll',sTap.sl===0&&sApp.sl>0&&sApp.auto===true,{t:sTap.sl,a:sApp.sl});
// 6 right blank
await page.evaluate(()=>{clearAll();});await typ('1+2');A=await anchors();await tap(A[0].x,A[0].y,100);
A=await anchors();await tap(d0.r-5,A[0].y,100);const pr=await curPath();A=await anchors();ok('6 right blank -> end',pr===A[A.length-1].p,{pr,end:A[A.length-1].p});
// 7 plot / matrix
for(const m of ['plot','matrix']){await page.evaluate(m=>switchMode(m),m);const b=await cur();const vis=await page.evaluate(()=>{const r=document.getElementById('single-line-display').getBoundingClientRect();return r.width>0&&r.height>0?{x:r.left+r.width/2,y:r.top+r.height/2}:null;});
 if(vis)await tap(vis.x,vis.y,100);else await page.evaluate(()=>{const d=document.getElementById('single-line-display');d.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,bubbles:true}));d.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,bubbles:true}));});
 const a=await page.evaluate(()=>window.__spc);ok('7 '+m+' no setCursorPath (visible='+!!vis+')',a===b.spc,{a,b:b.spc});}
await page.evaluate(()=>switchMode('main'));
ok('8 pageErrors=0',errors.length===0,errors.slice(0,3));
const f=out.filter(s=>s.startsWith('FAIL'));console.log((out.length-f.length)+'/'+out.length+' pass');out.filter(s=>s.startsWith('PASS')).forEach(s=>console.log(s));f.slice(0,3).forEach(s=>console.log(s));await browser.close();})();
}
async function port_i4b(open, press, __rec) {
  const console = quietConsole; const process = { env: global.process.env, exit(c) { throw new Error('i4b exit ' + c); } };
  return (async () => {
  const { browser, page, errors } = await open();
  let pass = 0, fail = 0; const out = [];
  const ok = (c, m) => { if (c) pass++; else { fail++; out.push('FAIL ' + m); } __rec(m, c); };
  async function setF(target, keys) {
    await page.evaluate(t => { switchMode('funcs'); setFuncTarget(t); clearAll(); }, target);
    for (const k of keys) { if (k === 't') await page.evaluate(() => append('t')); else await press(page, k); }
    return page.evaluate(t => state.expr[t === 'f' ? 'fx' : 'gx'], target);
  }
  async function solve(o) {
    await page.evaluate(() => { switchMode('roots'); });
    await page.click('#root-target-' + (o.target || 'f'));
    await page.click('#root-mode-inteq');
    await page.fill('#rootX1', String(o.x1)); await page.fill('#rootX2', String(o.x2));
    await page.fill('#inteqLower', o.lo); await page.fill('#inteqUpper', o.up); await page.fill('#inteqC', o.c);
    await page.evaluate(() => { document.getElementById('root-list').dataset.ms = ''; });
    const t0 = Date.now();
    await page.click('#root-btn-inteq');
    const busy = await page.evaluate(() => document.getElementById('root-list').innerText);
    await page.waitForFunction(() => document.getElementById('root-list').dataset.ms !== '', null, { timeout: 30000 });
    const wall = Date.now() - t0;
    const r = await page.evaluate(() => { const l = document.getElementById('root-list');
      return { text: l.innerText, ms: +l.dataset.ms, evals: l.dataset.evals, items: [...l.querySelectorAll('.root-katex-item')].map(d => d.querySelector('annotation') ? d.querySelector('annotation').textContent : d.textContent) }; });
    r.wall = wall; r.busy = busy; r.vals = r.items.map(s => parseFloat(s.split('=')[1])); return r;
  }
  const bench = [
    ['1', ['1'], '0', 'x', '2', 0.1, 10, 2],
    ['t', ['t'], '0', 'x', '2', 0.1, 10, 2],
    ['t,x..2x', ['t'], 'x', '2*x', '6', 0.1, 10, 2],
    ['t+x 0..1', ['t', '+', 'x'], '0', '1', '1', -10, 10, 0.5],
    ['t+x 0..x', ['t', '+', 'x'], '0', 'x', '4', 0.1, 10, Math.sqrt(8 / 3)],
  ];
  for (const [nm, keys, lo, up, c, x1, x2, exp] of bench) {
    const e = await setF('f', keys);
    const r = await solve({ lo, up, c, x1, x2 });
    const got = r.vals.length === 1 ? r.vals[0] : NaN; const err = Math.abs(got - exp);
    out.push(`B ${nm} expr=${e} exp=${exp.toPrecision(8)} got=${got} err=${err.toExponential(2)} ms=${r.ms} evals=${r.evals} wall=${r.wall} busy=${r.busy}`);
    ok(err < 1e-6 && /x\s*=/.test(r.items[0] || ''), nm + ' ' + r.text);
    ok(/\|G\(x\)\|/.test(r.text), nm + ' resid');
  }
  // errors
  await setF('f', ['t']);
  let r = await solve({ lo: '0', up: 'x', c: '2', x1: 5, x2: 1 }); ok(r.text.includes('Start 必须小于 End'), 'E1 ' + r.text); out.push('E1 ' + r.text);
  r = await solve({ lo: 'abc(', up: 'x', c: '2', x1: 0.1, x2: 10 }); ok(r.text.includes('下限 a(x) 表达式无法解析'), 'E2 ' + r.text); out.push('E2 ' + r.text);
  r = await solve({ lo: '0', up: 'x', c: 'x', x1: 0.1, x2: 10 }); ok(r.text.includes('右端常数 c 无效'), 'E3 ' + r.text); out.push('E3 ' + r.text);
  await page.evaluate(() => { switchMode('funcs'); setFuncTarget('g'); clearAll(); });
  r = await solve({ target: 'g', lo: '0', up: 'x', c: '2', x1: 0.1, x2: 10 }); ok(r.text.includes('被积函数未定义'), 'E4 ' + r.text); out.push('E4 ' + r.text);
  await setF('f', ['t', '*', 'y']);
  r = await solve({ target: 'f', lo: '0', up: 'x', c: '2', x1: 0.1, x2: 10 }); ok(r.text.includes('变量未定义'), 'E5 ' + r.text); out.push('E5 ' + r.text);
  await setF('f', ['t']);
  r = await solve({ target: 'f', lo: '0', up: 'z', c: '2', x1: 0.1, x2: 10 }); ok(r.text.includes('变量未定义'), 'E6 ' + r.text); out.push('E6 ' + r.text);
  // regression: algebraic roots
  await setF('f', ['x', 'POW', '2', 'R', '-', '4']);
  await page.evaluate(() => switchMode('roots'));
  await page.click('#root-mode-alg');
  const vis = await page.evaluate(() => [getComputedStyle(document.getElementById('inteq-inputs')).display, getComputedStyle(document.getElementById('root-btn-inteq')).display]);
  ok(vis[0] === 'none' && vis[1] === 'none', 'alg hides inteq ' + vis);
  await page.fill('#rootX1', '-10'); await page.fill('#rootX2', '10');
  await page.click('#root-btn-alg');
  const ar = await page.evaluate(() => [...document.querySelectorAll('#root-list annotation')].map(a => a.textContent));
  out.push('ALG ' + ar.join(' ; ')); ok(ar.length === 2 && /-2$/.test(ar[0]) && /= 2$/.test(ar[1]), 'alg roots ' + ar);
  // switching mode away and back keeps panel display flex
  await page.evaluate(() => { switchMode('main'); switchMode('roots'); });
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('roots-panel')).display === 'flex'), 'roots panel flex');
  ok(await page.evaluate(() => typeof InteqSolver.solveParamLimitIntegral === 'function'), 'InteqSolver global');
  ok(errors.length === 0, 'pageErrors ' + errors.slice(0, 2));
  out.forEach(s => console.log(s));
  console.log(`pass ${pass} / ${pass + fail} pageErrors=${errors.length}`);
  await browser.close();
})();
}

// ---------------- runner ----------------
function catOf(section, name) {
  if (section === 'i4b') {
    if (/^E\d/.test(name)) return 'error';
    if (/^InteqSolver global/.test(name)) return 'path';
    if (/^(alg |roots panel|pageErrors)/.test(name) || / resid$/.test(name)) return 'ui'; // resid = residual text shown
    return 'legal'; // benchmark: analytic expectation inside i4b
  }
  if (section === 'i2' && /^(log_2\(8\)=3|ln\(e\)=1|asin\(0\.5\)~)/.test(name)) return 'legal';
  return 'ui';
}
async function runPorted(section, fn) {
  const browsers = [];
  const trackedOpen = async () => { const o = await open(); browsers.push(o.browser); return o; };
  try { await fn(trackedOpen, press, (n, c, i) => rec(section, catOf(section, String(n)), n, c, i)); }
  catch (e) { rec(section, 'ui', section + ' crashed', false, String(e && e.message || e)); }
  finally { for (const b of browsers) { try { await b.close(); } catch (e) { /* already closed */ } } }
}
(async () => {
  const t0 = Date.now();
  try { await sectionNew(); } catch (e) { rec('new', 'ui', 'new section crashed', false, String(e && e.message || e)); }
  await runPorted('i2', port_i2); await runPorted('i3', port_i3);
  await runPorted('i4', port_i4); await runPorted('i4b', port_i4b);
  const cats = ['legal', 'error', 'ui', 'path'];
  const label = { legal: '合法数值', error: '预期错误', ui: 'UI/编辑行为', path: '通路验证' };
  for (const c of cats) { const r = RESULTS.filter(x => x.cat === c);
    console.log(`${label[c]} (${c}): ${r.filter(x => x.pass).length}/${r.length}`); }
  for (const s of ['new', 'i2', 'i3', 'i4', 'i4b']) { const r = RESULTS.filter(x => x.section === s);
    console.log(`  section ${s}: ${r.filter(x => x.pass).length}/${r.length}`); }
  const f = RESULTS.filter(x => !x.pass);
  console.log(`TOTAL ${RESULTS.length - f.length}/${RESULTS.length} pass, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  f.slice(0, 10).forEach(x => console.log(`FAIL [${x.section}/${x.cat}] ${x.name.slice(0, 60)} ${x.info}`));
  if (process.argv.includes('--list')) RESULTS.forEach(x => console.log(`${x.pass ? 'ok ' : 'NO '} ${x.section}/${x.cat} ${x.name.slice(0, 70)}`));
  process.exit(f.length ? 1 : 0); // explicit: never hang on a stray browser handle
})();