/* WebCASIO long-press bubble (Microsoft-Math style key popup).
   Press a key -> after longMs a square bubble appears above it -> keep the
   finger down, slide onto an option -> release to insert that option.
   Short tap inserts shortInput; release outside every option inserts nothing.

   Browser: window.LongPressBubble     Node: var LPB = require('./longpress-bubble.js');
   API: LongPressBubble.bind(button, options) -> { destroy() }
   No dependencies. Source is ASCII only; non-ASCII text must be written as
   \uXXXX escapes (e.g. '\u207b\u00b9' for superscript -1, '\u221b' cube root). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LongPressBubble = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DEFAULT_LONG_MS = 450, DEFAULT_MOVE_PX = 8;
  var GAP_PX = 8;          // bubble bottom sits this far above the button top
  var EDGE_PX = 6;         // min distance between bubble and viewport sides
  var TAIL_PAD = 10;       // tail stays within [10, width - 10] of the bubble
  var STYLE_ID = 'lpb-style';
  var NOSEL = 'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;';
  var CSS =
    '.lpb{position:absolute;z-index:1000;display:flex;gap:4px;padding:4px;box-sizing:border-box;' +
    'background:#fff;border:1px solid #3b82f6;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.18);' + NOSEL + '}' +
    '.lpb-item{display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-sizing:border-box;' +
    'white-space:nowrap;padding:0 10px;width:auto;border-radius:8px;background:#f3f6fa;color:#1f2937;' + NOSEL + '}' +
    '.lpb-item.lpb-hover{background:#3b82f6;color:#fff;}' +
    '.lpb-tail{position:absolute;bottom:-7px;width:0;height:0;margin-left:-7px;pointer-events:none;' +
    'border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid #3b82f6;}' +
    '.lpb-tail:after{content:"";position:absolute;left:-6px;top:-8px;width:0;height:0;' +
    'border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #fff;}';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // Pure geometry, viewport coordinates. btn = {left, top, width, height}.
  function computeLayout(btn, bubbleW, bubbleH, viewportW) {
    var cx = btn.left + btn.width / 2;
    var left = cx - bubbleW / 2;
    left = Math.min(left, viewportW - EDGE_PX - bubbleW);
    left = Math.max(left, EDGE_PX);          // too-wide bubble: pin to left edge
    var top = btn.top - GAP_PX - bubbleH;
    var tail = clamp(cx - left, TAIL_PAD, Math.max(TAIL_PAD, bubbleW - TAIL_PAD));
    return { left: left, top: top, tail: tail, itemHeight: btn.height * 2 / 3 };
  }

  function px(v) { return (Math.round(v * 100) / 100) + 'px'; }

  function injectStyle(doc) {
    if (doc.getElementById && doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (doc.head || doc.body).appendChild(st);
  }

  function removeNode(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }

  function bind(button, options) {
    var o = options || {};
    var doc = o.doc || button.ownerDocument || (typeof document !== 'undefined' ? document : null);
    var win = doc.defaultView || (typeof window !== 'undefined' ? window : {});
    var items = o.items || [];
    var longMs = o.longMs > 0 ? o.longMs : DEFAULT_LONG_MS;
    var movePx = o.movePx >= 0 ? o.movePx : DEFAULT_MOVE_PX;
    var usePointer = typeof win.PointerEvent === 'function' || typeof win.PointerEvent === 'object' ||
      !('ontouchstart' in win);
    var timer = null, active = false, moved = false, pid = null, x0 = 0, y0 = 0;
    var bubble = null, itemEls = [], hover = -1, captured = false, destroyed = false;

    function call(fn, v) { if (typeof fn === 'function' && v != null) fn(v); }

    function setHover(i) {
      if (i === hover) return;
      if (hover >= 0 && itemEls[hover]) itemEls[hover].classList.remove('lpb-hover');
      hover = i;
      if (hover >= 0 && itemEls[hover]) itemEls[hover].classList.add('lpb-hover');
    }

    function hitTest(x, y) {
      for (var i = 0; i < itemEls.length; i++) {
        var r = itemEls[i].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
      }
      return -1;
    }

    function showBubble() {
      timer = null;
      if (!active || !items.length) return;   // no options: long press is a no-op
      injectStyle(doc);
      var br = button.getBoundingClientRect();
      var ih = br.height * 2 / 3;
      bubble = doc.createElement('div');
      bubble.className = 'lpb';
      bubble.style.left = '0px';
      bubble.style.top = '0px';
      bubble.style.visibility = 'hidden';
      itemEls = [];
      for (var i = 0; i < items.length; i++) {
        var it = doc.createElement('div');
        it.className = 'lpb-item';
        it.innerHTML = items[i].label;
        it.style.height = px(ih);
        it.style.lineHeight = px(ih);
        bubble.appendChild(it);
        itemEls.push(it);
      }
      var tail = doc.createElement('div');
      tail.className = 'lpb-tail';
      bubble.appendChild(tail);
      doc.body.appendChild(bubble);
      var bb = bubble.getBoundingClientRect();
      var de = doc.documentElement;
      var vw = (de && de.clientWidth) || win.innerWidth || bb.width;
      var L = computeLayout(br, bb.width, bb.height, vw);
      var sx = win.pageXOffset || (de && de.scrollLeft) || 0;
      var sy = win.pageYOffset || (de && de.scrollTop) || 0;
      bubble.style.left = px(L.left + sx);
      bubble.style.top = px(L.top + sy);
      tail.style.left = px(L.tail);
      bubble.style.visibility = '';
      hover = -1;
    }

    function addDocListeners() {
      if (usePointer) {
        doc.addEventListener('pointermove', onMove);
        doc.addEventListener('pointerup', onUp);
        doc.addEventListener('pointercancel', onCancel);
      } else {
        doc.addEventListener('touchmove', onMove, { passive: false });
        doc.addEventListener('touchend', onUp);
        doc.addEventListener('touchcancel', onCancel);
      }
    }
    function removeDocListeners() {
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onCancel);
      doc.removeEventListener('touchmove', onMove, { passive: false });
      doc.removeEventListener('touchend', onUp);
      doc.removeEventListener('touchcancel', onCancel);
    }

    // Normalise pointer/touch events to {x, y, ok}; ok=false if another finger.
    function pt(e) {
      if (!usePointer) {
        var list = e.changedTouches || e.touches || [];
        for (var i = 0; i < list.length; i++) {
          if (pid == null || list[i].identifier === pid) {
            return { x: list[i].clientX, y: list[i].clientY, id: list[i].identifier, ok: true };
          }
        }
        return { ok: false };
      }
      return { x: e.clientX, y: e.clientY, id: e.pointerId, ok: pid == null || e.pointerId === pid };
    }

    function reset() {
      if (timer) { clearTimeout(timer); timer = null; }
      var wasCaptured = captured;
      captured = false;        // clear first: release may fire lostpointercapture synchronously
      if (wasCaptured && button.releasePointerCapture) {
        try { button.releasePointerCapture(pid); } catch (_) { /* unsupported */ }
      }
      active = false;
      pid = null;
      setHover(-1);
      removeNode(bubble);
      bubble = null;
      itemEls = [];
      removeDocListeners();
    }

    function onDown(e) {
      if (destroyed) return;
      if (usePointer && e.pointerType === 'mouse' && e.button !== 0) return;
      reset();
      pid = null;
      var p = pt(e);
      if (!p.ok) return;
      active = true; moved = false; pid = p.id; x0 = p.x; y0 = p.y;
      if (usePointer && button.setPointerCapture) {
        try { button.setPointerCapture(pid); captured = true; } catch (_) { captured = false; }
      }
      addDocListeners();
      timer = setTimeout(showBubble, longMs);
    }

    function onMove(e) {
      if (!active) return;
      var p = pt(e);
      if (!p.ok) return;
      if (bubble) {
        if (!usePointer && e.cancelable && e.preventDefault) e.preventDefault();
        setHover(hitTest(p.x, p.y));
        return;
      }
      if (timer && Math.sqrt((p.x - x0) * (p.x - x0) + (p.y - y0) * (p.y - y0)) > movePx) {
        moved = true;
        reset();               // scroll gesture: no bubble, no input
      }
    }

    function onUp(e) {
      if (!active) return;
      var p = pt(e);
      if (!p.ok) return;
      var out = null, pick = false;
      if (bubble) {
        var i = hitTest(p.x, p.y);
        if (i >= 0) { out = items[i].input; pick = true; }
      } else if (timer && !moved) {
        out = o.shortInput;
      }
      reset();
      if (pick) call(o.onPick, out); else call(o.onShort, out);
    }

    function onCancel(e) {
      if (!active) return;
      if (e && !pt(e).ok) return;
      reset();
    }

    function onLostCapture(e) {
      if (!active || !captured) return;
      if (e && e.pointerId !== pid) return;
      captured = false;        // already released by the browser
      reset();
    }

    function onContext(e) { if (e.preventDefault) e.preventDefault(); }

    // Keyboard / assistive activation (click without a pointer press).
    function onClick(e) { if (!destroyed && e.detail === 0) call(o.onShort, o.shortInput); }

    var downType = usePointer ? 'pointerdown' : 'touchstart';
    button.addEventListener(downType, onDown);
    button.addEventListener('lostpointercapture', onLostCapture);
    button.addEventListener('contextmenu', onContext);
    button.addEventListener('click', onClick);

    return {
      destroy: function () {
        if (destroyed) return;
        reset();
        destroyed = true;
        button.removeEventListener(downType, onDown);
        button.removeEventListener('lostpointercapture', onLostCapture);
        button.removeEventListener('contextmenu', onContext);
        button.removeEventListener('click', onClick);
      }
    };
  }

  return {
    bind: bind,
    computeLayout: computeLayout,
    DEFAULT_LONG_MS: DEFAULT_LONG_MS,
    DEFAULT_MOVE_PX: DEFAULT_MOVE_PX
  };
});
