const { chromium } = require('playwright-core');
const path = require('path');
const FILE = 'file:///' + path.resolve(process.env.CALC || 'C:/Users/28233/Documents/ChatGPT/WebCASIO/www/index.html').replace(/\\/g,'/');
// key tokens -> onclick attribute
const KEYMAP = {
  'f':"append('f(')", 'g':"append('g(')", 'INT':"append('int(')", 'DER':"append('deriv(')",
  'SQRT':"append('sqrt(')", 'FRAC':"append('frac(')", 'POW':"append('^{}')", 'LG':"append('log10(')", 'LN':"append('log(')",
  'SIN':'#key-sin', 'COS':'#key-cos', 'TAN':'#key-tan', 'PI':"append('pi')", 'E':"append('e')",
  '(':"append('(')", ')':"append(')')", 'L':'moveCursor(-1)', 'R':'moveCursor(1)', 'DEL':'deleteLast()', 'AC':'clearAll()',
  '*':"append('*')", '/':"append('/')", '+':"append('+')", '-':"append('-')", '.':"append('.')", 'EXP':"append('*10^{}')",
  'ANS':"append('Ans')", '=':'calculate()',
};
for (const d of '0123456789') KEYMAP[d] = `append('${d}')`;
for (const v of 'abcxyz') KEYMAP[v] = `append('${v}')`; // var row (x also in keyboard)
async function open() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  return { browser, page, errors };
}
async function press(page, key) {
  const extra = (globalThis.EXTRA_KEYMAP || {});
  return page.evaluate(([key, sel]) => {
    let btn = null;
    if (sel.startsWith('#')) btn = document.querySelector(sel);
    else btn = [...document.querySelectorAll('button')].find(b => b.getAttribute('onclick') === sel && b.offsetParent !== null)
            || [...document.querySelectorAll('button')].find(b => b.getAttribute('onclick') === sel);
    // I2: lg / ln 键已移除, 遗留用例直接调用 onclick 语句 (不经按钮)
    if (!btn && /^append\('log(10)?\('\)$/.test(sel)) { (0, eval)(sel); window.__legacyKeys = (window.__legacyKeys || 0) + 1; }
    else { if (!btn) throw new Error('no button for ' + key + ' ' + sel);
    btn.click(); }
    const disp = document.getElementById('single-line-display');
    let tex = ''; try { tex = getDisplayTex(currentExpression, state.mode); } catch (e) { tex = 'TEXERR:' + e.message; }
    return { key, expr: currentExpression, cur: cursorPos, tex,
      err: /过于复杂/.test(disp.innerText), cursors: disp.querySelectorAll('.cursor-blink').length,
      res: document.getElementById('calc-res-val').innerText };
  }, [key, extra[key] || KEYMAP[key]]);
}
module.exports = { open, press, KEYMAP };
