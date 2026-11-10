// S4 patch: physical constants panel UI. Run ONCE: node tools\s4-patch.js
// Anchors are asserted unique; aborts without writing if any anchor fails.
const fs = require('fs');
const FILE = 'C:/Users/28233/Documents/ChatGPT/WebCASIO/www/index.html';
let s = fs.readFileSync(FILE, 'utf8');
const crlf = t => t.replace(/\r?\n/g, '\r\n');
function rep(anchor, replacement) {
  const a = crlf(anchor);
  const n = s.split(a).length - 1;
  if (n !== 1) { console.error('ANCHOR COUNT ' + n + ': ' + JSON.stringify(a.slice(0, 80))); process.exit(1); }
  s = s.replace(a, () => crlf(replacement));
}

// 1. var row grid: 6 narrow var buttons + 1 wider const button
rep('#var-btns-row { display: grid; grid-template-columns: repeat(7, 2fr); gap: 6px; flex-shrink: 0; }',
    '#var-btns-row { display: grid; grid-template-columns: repeat(6, 1fr) 1.9fr; gap: 6px; flex-shrink: 0; }');

// 2. CSS
rep(`        .btn-var-sm:active { transform: scale(0.94); background-color: #f5f5f5; }
`, `        .btn-var-sm:active { transform: scale(0.94); background-color: #f5f5f5; }
        .btn-const {
            font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-style: normal;
            font-size: 12px; font-weight: 700; color: var(--btn-primary); white-space: nowrap;
        }
        .btn-const.active { background: var(--btn-primary); color: #fff; border-color: var(--btn-primary); }

        #const-panel { display: none; flex: 1; min-height: 0; flex-direction: column; gap: 6px; }
        .const-toolbar { display: grid; grid-template-columns: repeat(3, 1fr) 2fr; gap: 6px; flex-shrink: 0; }
        .const-toolbar button { height: 36px; font-size: 17px; }
        .const-toolbar .const-back { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 700; }
        .const-list {
            flex: 1; min-height: 0; overflow-y: auto; display: grid;
            grid-template-columns: 1fr 1fr; gap: 6px; align-content: start;
            touch-action: pan-y; overscroll-behavior: contain; padding-bottom: 4px;
        }
        .const-group-title {
            grid-column: 1 / -1; padding: 4px 2px 0;
            font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
            font-size: 12px; font-weight: 700; color: #8a94a3;
        }
        .const-cell {
            height: 44px; border-radius: 10px; padding: 0 8px; min-width: 0;
            display: flex; align-items: center; justify-content: flex-start;
            overflow: hidden; white-space: nowrap; font-size: 15px; font-weight: 400;
            user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: pan-y;
        }
        .const-cell .c-sym { flex-shrink: 0; }
        .const-cell .c-name {
            min-width: 0; overflow: hidden; text-overflow: ellipsis; color: #444;
            font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 13px;
        }
        .const-cell .c-val { display: none; font-size: 12px; color: var(--text-main); }
        .const-cell.show-val { background: #eef4fd; border-color: var(--btn-primary); }
        .const-cell.show-val .c-sym, .const-cell.show-val .c-name { display: none; }
        .const-cell.show-val .c-val { display: block; }
`);

// 3. HTML: const button as 7th child of #var-btns-row
rep(`        <button class="btn-var-sm" onclick="append('z')">z</button>
`, `        <button class="btn-var-sm" onclick="append('z')">z</button>
        <button class="btn-var-sm btn-const" id="btn-const" onclick="toggleConstPanel()">物理常数</button>
`);

// 4. HTML: panel right after #keyboard-area (same flex slot)
rep(`        <button class="btn-calc" onclick="calculate()">=</button>
    </div>
`, `        <button class="btn-calc" onclick="calculate()">=</button>
    </div>

    <div id="const-panel">
        <div class="const-toolbar">
            <button onclick="moveCursor(-1)">←</button>
            <button onclick="moveCursor(1)">→</button>
            <button class="btn-danger" onclick="deleteLast()">DEL</button>
            <button class="const-back" onclick="toggleConstPanel()">返回键盘</button>
        </div>
        <div class="const-list" id="const-list"></div>
    </div>
`);

// 5. switchMode closes the panel
rep(`    document.getElementById('nav-' + m).classList.add('active');
    state.mode = m;
`, `    document.getElementById('nav-' + m).classList.add('active');
    state.mode = m;
    if (constPanelOpen) setConstPanel(false);
`);

// 6. JS
rep(`document.addEventListener('keydown', function(e) {`,
`// ===== S4: 物理常数面板 =====
// 短按 -> 在光标处插入原子常数; 长按 450ms -> cell 内显示科学记数法, 松手恢复且不插入;
// 移动超过 8px 视为滚动, 不插入.
let constPanelOpen = false, constPanelBuilt = false;
const CONST_LONG_MS = 450, CONST_MOVE_PX = 8, CONST_SHOW_SIG = 10;
function buildConstPanel() {
    if (constPanelBuilt) return;
    constPanelBuilt = true;
    const list = document.getElementById('const-list');
    CONST_GROUPS.forEach(g => {
        const t = document.createElement('div');
        t.className = 'const-group-title'; t.textContent = g.label;
        list.appendChild(t);
        g.items.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'const-cell'; b.dataset.id = c.id;
            const sym = document.createElement('span'); sym.className = 'c-sym';
            const name = document.createElement('span'); name.className = 'c-name'; name.textContent = '：' + c.name;
            const val = document.createElement('span'); val.className = 'c-val';
            katex.render(c.tex, sym, { throwOnError:false });
            const sp = constSciParts(c.id, CONST_SHOW_SIG);
            katex.render(sp ? sp.tex : '?', val, { throwOnError:false });
            b.title = c.name;
            b.append(sym, name, val);
            bindConstCell(b);
            list.appendChild(b);
        });
    });
}
function bindConstCell(b) {
    let timer = null, pid = null, x0 = 0, y0 = 0, longShown = false, moved = false;
    const reset = () => { clearTimeout(timer); timer = null; pid = null; b.classList.remove('show-val'); };
    b.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        reset();
        pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; longShown = false; moved = false;
        timer = setTimeout(() => { timer = null; longShown = true; b.classList.add('show-val'); }, CONST_LONG_MS);
    });
    b.addEventListener('pointermove', e => {
        if (e.pointerId !== pid || moved) return;
        if (Math.hypot(e.clientX - x0, e.clientY - y0) > CONST_MOVE_PX) {
            moved = true;
            if (!longShown) { clearTimeout(timer); timer = null; }
        }
    });
    b.addEventListener('pointerup', e => {
        if (e.pointerId !== pid) return;
        const insert = !longShown && !moved;
        reset();
        if (insert) append('const:' + b.dataset.id);
    });
    b.addEventListener('pointercancel', reset);
    b.addEventListener('pointerleave', e => { if (e.pointerId === pid) { moved = true; reset(); } });
    b.addEventListener('contextmenu', e => e.preventDefault());
    // 键盘激活 (detail === 0) 没有 pointer 事件, 单独处理
    b.addEventListener('click', e => { if (e.detail === 0) append('const:' + b.dataset.id); });
}
function setConstPanel(open) {
    constPanelOpen = open;
    if (open) buildConstPanel();
    document.getElementById('const-panel').style.display = open ? 'flex' : 'none';
    document.getElementById('keyboard-area').style.display = open ? 'none' : 'grid';
    document.getElementById('btn-const').classList.toggle('active', open);
}
function toggleConstPanel() { setConstPanel(!constPanelOpen); }

document.addEventListener('keydown', function(e) {`);

fs.writeFileSync(FILE, s, 'utf8');
console.log('S4 PATCH OK, bytes=' + Buffer.byteLength(s));
