/* Node-only tests for tools/longpress-bubble.js. No dependencies, no jsdom.
   Run: node tools/longpress-bubble.test.js */
'use strict';
var LPB = require('./longpress-bubble.js');

// ---- fake clock ----
var now = 0, timers = [], tid = 0;
global.setTimeout = function (fn, ms) { var t = { id: ++tid, at: now + ms, fn: fn }; timers.push(t); return t.id; };
global.clearTimeout = function (id) { timers = timers.filter(function (t) { return t.id !== id; }); };
function advance(ms) {
  var end = now + ms;
  for (;;) {
    timers.sort(function (a, b) { return a.at - b.at; });
    var t = timers[0];
    if (!t || t.at > end) break;
    timers.shift(); now = t.at; t.fn();
  }
  now = end;
}

// ---- fake DOM ----
var ITEM_W = 40;
function Emitter() { this._l = {}; }
Emitter.prototype.addEventListener = function (type, fn) {
  (this._l[type] = this._l[type] || []);
  if (this._l[type].indexOf(fn) < 0) this._l[type].push(fn);
};
Emitter.prototype.removeEventListener = function (type, fn) {
  var a = this._l[type]; if (!a) return; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
};
Emitter.prototype.dispatch = function (type, props) {
  var e = props || {}; e.type = type; e.preventDefault = function () { e.defaultPrevented = true; };
  (this._l[type] || []).slice().forEach(function (fn) { fn(e); });
  return e;
};
Emitter.prototype.count = function () {
  var n = 0, k; for (k in this._l) n += this._l[k].length; return n;
};

function El(doc, tag) {
  Emitter.call(this);
  var self = this;
  this.ownerDocument = doc; this.tagName = tag; this.children = []; this.parentNode = null;
  this.style = {}; this.className = ''; this.innerHTML = ''; this.id = ''; this.textContent = '';
  this._rect = null;
  this.classList = {
    add: function (c) { if (!this.contains(c)) self.className = (self.className + ' ' + c).trim(); },
    remove: function (c) { self.className = self.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
    contains: function (c) { return self.className.split(/\s+/).indexOf(c) >= 0; }
  };
}
El.prototype = Object.create(Emitter.prototype);
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); return c; };
El.prototype.removeChild = function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; };
El.prototype.getBoundingClientRect = function () {
  if (this._rect) return mk(this._rect.left, this._rect.top, this._rect.width, this._rect.height);
  if (this.classList.contains('lpb')) {
    var its = this.children.filter(function (c) { return c.classList.contains('lpb-item'); });
    var ih = its.length ? parseFloat(its[0].style.height) : 0;
    return mk(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0,
      8 + its.length * ITEM_W + (its.length - 1) * 4, 8 + ih);
  }
  if (this.classList.contains('lpb-item')) {
    var b = this.parentNode.getBoundingClientRect();
    var idx = this.parentNode.children.indexOf(this);
    return mk(b.left + 4 + idx * (ITEM_W + 4), b.top + 4, ITEM_W, parseFloat(this.style.height));
  }
  return mk(0, 0, 0, 0);
};
function mk(l, t, w, h) { return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h }; }

function makeDoc(vw, withCapture) {
  var doc = new Emitter();
  doc.defaultView = { PointerEvent: function () {}, innerWidth: vw, pageXOffset: 0, pageYOffset: 0 };
  doc.documentElement = { clientWidth: vw, scrollLeft: 0, scrollTop: 0 };
  doc.createElement = function (tag) { return new El(doc, tag); };
  doc.head = new El(doc, 'head'); doc.body = new El(doc, 'body');
  doc.getElementById = function (id) {
    var hit = null;
    (function walk(n) { n.children.forEach(function (c) { if (c.id === id) hit = c; walk(c); }); })(doc.head);
    return hit;
  };
  var btn = new El(doc, 'button');
  btn.captures = [];
  if (withCapture) {
    btn.setPointerCapture = function (id) { btn.captures.push('set' + id); };
    btn.releasePointerCapture = function (id) { btn.captures.push('rel' + id); throw new Error('unsupported'); };
  }
  doc.body.appendChild(btn);
  return { doc: doc, btn: btn };
}

function bubbles(doc) { return doc.body.children.filter(function (c) { return c.classList.contains('lpb'); }); }

// ---- assertions ----
var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.log('FAIL: ' + msg); } }
function eq(a, b, msg) { ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function near(a, b, msg) { ok(Math.abs(a - b) < 0.02, msg + ' (got ' + a + ', want ' + b + ')'); }

var ITEMS = [
  { label: 'sin\u207b\u00b9', input: 'asin(' },
  { label: '\u221b', input: 'cbrt(' },
  { label: '\u03c0', input: 'pi' }
];
function setup(opts) {
  opts = opts || {};
  var env = makeDoc(opts.vw || 360, opts.capture !== false);
  env.btn._rect = opts.rect || { left: 100, top: 400, width: 60, height: 48 };
  env.shorts = []; env.picks = [];
  env.h = LPB.bind(env.btn, {
    items: opts.items || ITEMS, shortInput: 'sin(', doc: env.doc,
    onShort: function (v) { env.shorts.push(v); }, onPick: function (v) { env.picks.push(v); }
  });
  return env;
}
function down(env, x, y) { env.btn.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y }); }
function move(env, x, y) { env.doc.dispatch('pointermove', { pointerId: 1, clientX: x, clientY: y }); }
function up(env, x, y) { env.doc.dispatch('pointerup', { pointerId: 1, clientX: x, clientY: y }); }
function center(el) { var r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

// 1. short tap
var e = setup();
down(e, 130, 420); advance(100); up(e, 130, 420);
eq(e.shorts.length, 1, 'short tap calls onShort once'); eq(e.shorts[0], 'sin(', 'short tap writes shortInput');
eq(e.picks.length, 0, 'short tap does not pick'); eq(bubbles(e.doc).length, 0, 'short tap shows no bubble');
eq(e.btn.captures[0], 'set1', 'setPointerCapture called with pointerId');
ok(e.btn.captures.indexOf('rel1') >= 0, 'releasePointerCapture called (throwing impl tolerated)');
eq(e.doc.count(), 0, 'document listeners removed after release');

// 2. small jitter below threshold still a short tap
e = setup(); down(e, 130, 420); move(e, 135, 424); advance(200); up(e, 135, 424);
eq(e.shorts.join(), 'sin(', 'jitter <= movePx keeps short tap');

// 3. long press shows bubble and does not write shortInput
e = setup(); down(e, 130, 420); advance(449);
eq(bubbles(e.doc).length, 0, 'no bubble before longMs'); advance(1);
var bs = bubbles(e.doc);
eq(bs.length, 1, 'bubble appended to body at longMs');
ok(!!e.doc.getElementById('lpb-style'), 'style injected');
var items = bs[0].children.filter(function (c) { return c.classList.contains('lpb-item'); });
eq(items.length, 3, 'three options rendered'); eq(items[1].innerHTML, '\u221b', 'label html kept');
eq(bs[0].children.filter(function (c) { return c.classList.contains('lpb-tail'); }).length, 1, 'tail rendered');
near(parseFloat(items[0].style.height), 32, 'item height = 48 * 2/3');
// move beyond movePx after bubble -> no cancel; hover tracking
var c0 = center(items[0]);
move(e, c0[0], c0[1]);
ok(items[0].classList.contains('lpb-hover'), 'hover on option 1');
eq(bubbles(e.doc).length, 1, 'movement after bubble does not cancel');
var c2 = center(items[2]); move(e, c2[0], c2[1]);
ok(!items[0].classList.contains('lpb-hover') && items[2].classList.contains('lpb-hover'), 'hover moves to option 3');
move(e, c0[0], c0[1]); up(e, c0[0], c0[1]);
eq(e.picks.join(), 'asin(', 'release on option 1 picks its input');
eq(e.shorts.length, 0, 'long press never writes shortInput');
eq(bubbles(e.doc).length, 0, 'bubble removed after pick');

// 4. long press, hold, release without moving (on the button) -> nothing
e = setup(); down(e, 130, 420); advance(600); up(e, 130, 420);
eq(e.shorts.length + e.picks.length, 0, 'long press released on button writes nothing');

// 5. release on blank area
e = setup(); down(e, 130, 420); advance(500); move(e, 10, 10); up(e, 10, 10);
eq(e.shorts.length + e.picks.length, 0, 'release on blank writes nothing');
eq(bubbles(e.doc).length, 0, 'bubble removed after blank release');

// 6. move beyond threshold before timer
e = setup(); down(e, 130, 420); move(e, 130, 440); advance(1000);
eq(bubbles(e.doc).length, 0, 'scroll gesture: no bubble'); up(e, 130, 440);
eq(e.shorts.length + e.picks.length, 0, 'scroll gesture: nothing written');

// 7. pointercancel
e = setup(); down(e, 130, 420); advance(500); items = bubbles(e.doc)[0].children;
c0 = center(items[0]); move(e, c0[0], c0[1]);
e.doc.dispatch('pointercancel', { pointerId: 1 });
eq(bubbles(e.doc).length, 0, 'pointercancel removes bubble'); up(e, c0[0], c0[1]);
eq(e.shorts.length + e.picks.length, 0, 'pointercancel writes nothing');
e = setup(); down(e, 130, 420); e.doc.dispatch('pointercancel', { pointerId: 1 }); advance(1000); up(e, 130, 420);
eq(e.shorts.length + bubbles(e.doc).length, 0, 'pointercancel before timer: no short, no bubble');

// 8. lostpointercapture
e = setup(); down(e, 130, 420); advance(500);
e.btn.dispatch('lostpointercapture', { pointerId: 1 });
eq(bubbles(e.doc).length, 0, 'lostpointercapture removes bubble');

// 9. geometry: centred, 8px above
e = setup(); down(e, 130, 420); advance(500);
var b = bubbles(e.doc)[0], r = b.getBoundingClientRect();     // width = 8 + 3*40 + 2*4 = 136
near(r.left + r.width / 2, 130, 'bubble centred on button');
near(r.bottom, 400 - 8, 'bubble bottom 8px above button top');
var tail = b.children.filter(function (c) { return c.classList.contains('lpb-tail'); })[0];
near(parseFloat(tail.style.left), 68, 'tail at button centre');
up(e, 0, 0);

// 10. right edge clamp
e = setup({ vw: 360, rect: { left: 330, top: 400, width: 30, height: 30 } }); down(e, 345, 410); advance(500);
b = bubbles(e.doc)[0]; r = b.getBoundingClientRect();
ok(r.right <= 360 - 6 + 0.01, 'right clamp: bubble right <= vw - 6 (' + r.right + ')');
near(r.right, 354, 'right clamp exact');
tail = b.children[b.children.length - 1];
near(parseFloat(tail.style.left), r.width - 10, 'tail clamped to width - 10');
near(parseFloat(b.children[0].style.height), 20, 'item height = 30 * 2/3');
up(e, 0, 0);

// 11. left edge clamp
e = setup({ rect: { left: 0, top: 400, width: 20, height: 45 } }); down(e, 10, 420); advance(500);
r = bubbles(e.doc)[0].getBoundingClientRect();
near(r.left, 6, 'left clamp: bubble left = 6');
tail = bubbles(e.doc)[0].children[3];
near(parseFloat(tail.style.left), 10, 'tail clamped to 10');
up(e, 0, 0);

// 12. pure layout helper
var L = LPB.computeLayout({ left: 100, top: 300, width: 50, height: 60 }, 80, 40, 400);
near(L.left, 85, 'computeLayout left'); near(L.top, 252, 'computeLayout top');
near(L.tail, 40, 'computeLayout tail'); near(L.itemHeight, 40, 'computeLayout itemHeight');

// 13. no setPointerCapture available
e = setup({ capture: false }); down(e, 130, 420); advance(500);
items = bubbles(e.doc)[0].children; c2 = center(items[2]); move(e, c2[0], c2[1]); up(e, c2[0], c2[1]);
eq(e.picks.join(), 'pi', 'works without pointer capture API');

// 14. other pointer ignored
e = setup(); down(e, 130, 420); e.doc.dispatch('pointerup', { pointerId: 2, clientX: 130, clientY: 420 });
eq(e.shorts.length, 0, 'other pointerId ignored'); up(e, 130, 420); eq(e.shorts.length, 1, 'own pointer still completes');

// 15. style injected once
e = setup(); down(e, 130, 420); advance(500); up(e, 0, 0); down(e, 130, 420); advance(500); up(e, 0, 0);
eq(e.doc.head.children.filter(function (c) { return c.id === 'lpb-style'; }).length, 1, 'style injected only once');

// 16. destroy
e = setup(); e.h.destroy();
down(e, 130, 420); advance(100); up(e, 130, 420);
down(e, 130, 420); advance(600);
eq(bubbles(e.doc).length, 0, 'destroy: no bubble'); up(e, 130, 420);
eq(e.shorts.length + e.picks.length, 0, 'destroy: no callbacks');
eq(e.btn.count() + e.doc.count(), 0, 'destroy: all listeners removed');
e = setup(); down(e, 130, 420); advance(500); e.h.destroy();
eq(bubbles(e.doc).length, 0, 'destroy mid-press removes bubble');

// 17. source is ASCII and UMD
var src = require('fs').readFileSync(require('path').join(__dirname, 'longpress-bubble.js'), 'utf8');
ok(/^[\x00-\x7f]*$/.test(src), 'source is pure ASCII');
new Function('module', src)(undefined);   // browser path: root = globalThis (window)
eq(typeof (globalThis.LongPressBubble && globalThis.LongPressBubble.bind), 'function', 'UMD attaches window.LongPressBubble');
delete globalThis.LongPressBubble;

if (failed) { console.log('TESTS FAILED ' + passed + ' passed, ' + failed + ' failed'); process.exit(1); }
console.log('TESTS OK ' + passed + ' passed, 0 failed');
