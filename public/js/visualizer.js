/* FenceTopper visualizer: draws a to-scale topper above the fence in a photo.
   The customer drags four handles to mark the top and bottom of their fence;
   topper height in pixels = fence height in pixels x (topper inches / fence inches). */
(function () {
  'use strict';
  var FT = window.FT || { store: { get: function (k, d) { return d; }, set: function () {} } };
  var canvas = document.getElementById('viz-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var photo = null;          // HTMLImageElement or canvas
  var W = 1600, H = 1000;
  var state = {
    color: FT.store.get('color', 'carbon'),
    height: 18,
    fenceFt: 6,
    posts: 4,
    guides: true,
    show: true,
    // handles in image pixel coords
    h: null,
  };
  var COLORS = { carbon: '#3A3C3F', black: '#111214', evergreen: '#3A4B3C', brown: '#5A4134' };

  // ---------- Sample yard (drawn, so it has no topper yet) ----------
  function sampleYard() {
    var c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
    var g = c.getContext('2d');
    var sky = g.createLinearGradient(0, 0, 0, 600); sky.addColorStop(0, '#9cc6e6'); sky.addColorStop(1, '#dcebf3');
    g.fillStyle = sky; g.fillRect(0, 0, 1600, 1000);
    // trees behind
    function blob(x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    [[90, 380, 150], [230, 330, 120], [1450, 360, 160], [1560, 420, 120], [1320, 420, 100]].forEach(function (t) { blob(t[0], t[1], t[2], '#4f7a45'); blob(t[0] - 30, t[1] - 30, t[2] * .7, '#5e8a50'); });
    // neighbor house
    g.fillStyle = '#c9c2b6'; g.fillRect(420, 300, 760, 400);
    g.fillStyle = '#6b4f45'; g.beginPath(); g.moveTo(380, 310); g.lineTo(800, 150); g.lineTo(1220, 310); g.closePath(); g.fill();
    g.fillStyle = '#b5ad9f'; for (var y = 320; y < 700; y += 18) g.fillRect(420, y, 760, 2);
    // windows looking into the yard
    [[500, 420], [740, 420], [980, 420]].forEach(function (p) {
      g.fillStyle = '#f4f1ea'; g.fillRect(p[0] - 8, p[1] - 8, 136, 136);
      var wg = g.createLinearGradient(p[0], p[1], p[0] + 120, p[1] + 120); wg.addColorStop(0, '#5d7486'); wg.addColorStop(1, '#2f3f4c');
      g.fillStyle = wg; g.fillRect(p[0], p[1], 120, 120);
      g.fillStyle = '#f4f1ea'; g.fillRect(p[0] + 58, p[1], 4, 120); g.fillRect(p[0], p[1] + 58, 120, 4);
    });
    // cedar fence: top 560, bottom 860
    var top = 520, bot = 940;
    for (var x = 0; x < 1600; x += 40) {
      var shade = 0.85 + ((x * 7919) % 100) / 700;
      g.fillStyle = 'rgb(' + Math.round(178 * shade) + ',' + Math.round(124 * shade) + ',' + Math.round(78 * shade) + ')';
      g.fillRect(x, top, 39, bot - top);
      g.fillStyle = 'rgba(60,35,15,.25)'; g.fillRect(x + 38, top, 2, bot - top);
    }
    g.fillStyle = 'rgba(90,55,25,.35)'; g.fillRect(0, top, 1600, 8); g.fillRect(0, top + 120, 1600, 4);
    for (x = 0; x < 1600; x += 320) { g.fillStyle = '#8a5a34'; g.fillRect(x, top - 6, 18, bot - top + 6); }
    // lawn and patio
    var lawn = g.createLinearGradient(0, bot, 0, 1000); lawn.addColorStop(0, '#5f8f43'); lawn.addColorStop(1, '#7aa955');
    g.fillStyle = lawn; g.fillRect(0, bot, 1600, 60);
    [[160, 950], [420, 965], [1180, 955], [1430, 960]].forEach(function (s) { blob(s[0], s[1], 55, '#3f6e36'); blob(s[0] + 40, s[1] + 10, 40, '#4b7d3e'); });
    g.fillStyle = '#d8d2c6'; g.beginPath(); g.moveTo(600, 1000); g.lineTo(680, 945); g.lineTo(1060, 945); g.lineTo(1120, 1000); g.fill();
    return c;
  }

  // Sample photos, with the top and bottom of each fence marked in the photo's own pixels (1448 x 1086).
  var SAMPLES = {
    pool: { src: '/img/samples/pool.webp', fence: { x0: 30, x1: 1448, top: 256, bot: 632 } },
    patio: { src: '/img/samples/patio.webp', fence: { x0: 0, x1: 1400, top: 303, bot: 646 } },
  };

  function defaultHandles() {
    if (photo && photo.fence) {
      var f = photo.fence, k = W / photo.width;
      return { tl: { x: f.x0 * k, y: f.top * k }, tr: { x: f.x1 * k, y: f.top * k }, bl: { y: f.bot * k }, br: { y: f.bot * k } };
    }
    if (!photo || photo.isSample) return { tl: { x: 0, y: 520 }, tr: { x: W, y: 520 }, bl: { y: 940 }, br: { y: 940 } };
    return { tl: { x: W * .04, y: H * .5 }, tr: { x: W * .96, y: H * .5 }, bl: { y: H * .82 }, br: { y: H * .82 } };
  }

  function setPhoto(img, isSample) {
    photo = img; photo.isSample = !!isSample;
    var scale = Math.min(1, 1600 / img.width);
    W = Math.round(img.width * scale); H = Math.round(img.height * scale);
    canvas.width = W; canvas.height = H;
    state.h = defaultHandles();
    draw();
  }

  // ---------- Drawing ----------
  var weave = null;
  function weavePattern(hex) {
    var p = document.createElement('canvas'); p.width = 6; p.height = 6;
    var g = p.getContext('2d');
    g.fillStyle = hex; g.fillRect(0, 0, 6, 6);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, 3, 6); g.fillRect(0, 0, 6, 1);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(3, 3, 3, 3);
    return ctx.createPattern(p, 'repeat');
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (photo) ctx.drawImage(photo, 0, 0, W, H);
    var h = state.h; if (!h) return;
    var x0 = h.tl.x, x1 = h.tr.x;
    var topAt = function (t) { return lerp(h.tl.y, h.tr.y, t); };
    var botAt = function (t) { return lerp(h.bl.y, h.br.y, t); };
    var ratio = state.height / (state.fenceFt * 12);
    var thL = (botAt(0) - topAt(0)) * ratio, thR = (botAt(1) - topAt(1)) * ratio;

    if (state.show) {
      var hex = COLORS[state.color] || COLORS.carbon;
      weave = weavePattern(hex);
      // panel body
      ctx.beginPath();
      ctx.moveTo(x0, topAt(0)); ctx.lineTo(x1, topAt(1));
      ctx.lineTo(x1, topAt(1) - thR); ctx.lineTo(x0, topAt(0) - thL); ctx.closePath();
      ctx.fillStyle = weave; ctx.fill();
      // soft daylight gradient across the face
      var lg = ctx.createLinearGradient(0, topAt(0) - thL, 0, topAt(0));
      lg.addColorStop(0, 'rgba(255,255,255,.10)'); lg.addColorStop(.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,.18)');
      ctx.fillStyle = lg; ctx.fill();
      // hems: thin stitched lines near top and bottom (2 in of the height)
      var hemL = thL * (2 / state.height), hemR = thR * (2 / state.height);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, thL / 60);
      ctx.beginPath(); ctx.moveTo(x0, topAt(0) - thL + hemL); ctx.lineTo(x1, topAt(1) - thR + hemR); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, topAt(0) - hemL); ctx.lineTo(x1, topAt(1) - hemR); ctx.stroke();
      // posts and caps
      var n = Math.max(2, state.posts);
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), x = lerp(x0, x1, t);
        var ty = topAt(t), th = lerp(thL, thR, t);
        var fencePx = botAt(t) - ty;
        var pw = Math.max(3, fencePx * 1.5 / (state.fenceFt * 12)); // 1.5 in post, to scale
        var postGrad = ctx.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
        postGrad.addColorStop(0, '#2a2c2e'); postGrad.addColorStop(.4, '#4a4d50'); postGrad.addColorStop(1, '#0c0d0e');
        ctx.fillStyle = postGrad;
        ctx.fillRect(x - pw / 2, ty - th, pw, th);
        // pocket bulge on inner posts
        if (i > 0 && i < n - 1) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - pw * 1.6, ty - th, pw * .5, th); ctx.fillRect(x + pw * 1.1, ty - th, pw * .5, th); }
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(x, ty - th - pw * .35, pw * .62, pw * .45, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (state.guides) {
      ctx.lineWidth = Math.max(2, W / 600);
      ctx.setLineDash([W / 100, W / 160]);
      ctx.strokeStyle = '#ffd34d';
      ctx.beginPath(); ctx.moveTo(x0, h.tl.y); ctx.lineTo(x1, h.tr.y); ctx.stroke();
      ctx.strokeStyle = '#7fd3ff';
      ctx.beginPath(); ctx.moveTo(x0, h.bl.y); ctx.lineTo(x1, h.br.y); ctx.stroke();
      ctx.setLineDash([]);
      var r = handleRadius();
      [['tl', h.tl.x, h.tl.y, '#ffd34d'], ['tr', h.tr.x, h.tr.y, '#ffd34d'], ['bl', x0, h.bl.y, '#7fd3ff'], ['br', x1, h.br.y, '#7fd3ff']].forEach(function (d) {
        var cx = Math.min(Math.max(d[1], r), W - r);
        ctx.beginPath(); ctx.arc(cx, d[2], r * .62, 0, Math.PI * 2);
        ctx.fillStyle = d[3]; ctx.fill(); ctx.lineWidth = r * .18; ctx.strokeStyle = '#1b1b1b'; ctx.stroke();
      });
      ctx.font = '600 ' + Math.round(r * 1.2) + 'px Figtree, system-ui, sans-serif';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4;
      var lx = x0 + r * 1.6;
      ctx.strokeText('Top of fence', lx, h.tl.y + r * 1.9); ctx.fillText('Top of fence', lx, h.tl.y + r * 1.9);
      ctx.strokeText('Bottom of fence', lx, h.bl.y - r * 1.1); ctx.fillText('Bottom of fence', lx, h.bl.y - r * 1.1);
    }
    paintReadout();
  }

  function cssScale() { return W / (canvas.getBoundingClientRect().width || W); }
  // drawn size stays proportional to the photo; the touch target stays ~22 css px
  function handleRadius() { return Math.min(Math.max(14, 16 * cssScale()), W * 0.028); }
  function hitRadius() { return Math.max(handleRadius(), 24 * cssScale()); }

  function paintReadout() {
    var el = document.getElementById('viz-readout');
    if (!el) return;
    var total = state.fenceFt * 12 + state.height, ft = Math.floor(total / 12), inch = total % 12;
    el.textContent = state.fenceFt + '\' fence height + ' + state.height + '" topper = ' + ft + '\'' + (inch ? inch + '"' : '') + ' of privacy'; // 6' fence height + 18" topper = 7'6" of privacy
  }

  // ---------- Dragging ----------
  var drag = null;
  function toImg(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function hit(p) {
    var h = state.h, r = hitRadius();
    var pts = { tl: [h.tl.x, h.tl.y], tr: [h.tr.x, h.tr.y], bl: [h.tl.x, h.bl.y], br: [h.tr.x, h.br.y] };
    var best = null, bd = r;
    for (var k in pts) {
      var cx = Math.min(Math.max(pts[k][0], handleRadius()), W - handleRadius());
      var d = Math.hypot(p.x - cx, p.y - pts[k][1]);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (!state.guides) return;
    var k = hit(toImg(e));
    if (!k) return;
    drag = k; canvas.setPointerCapture(e.pointerId); e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = toImg(e);
    if (!drag) { canvas.style.cursor = state.guides && hit(p) ? 'grab' : 'default'; return; }
    var h = state.h, y = Math.min(Math.max(p.y, 0), H), x = Math.min(Math.max(p.x, 0), W);
    if (drag === 'tl') { h.tl.y = Math.min(y, h.bl.y - 10); h.tl.x = Math.min(x, h.tr.x - 40); }
    if (drag === 'tr') { h.tr.y = Math.min(y, h.br.y - 10); h.tr.x = Math.max(x, h.tl.x + 40); }
    if (drag === 'bl') h.bl.y = Math.max(y, h.tl.y + 10);
    if (drag === 'br') h.br.y = Math.max(y, h.tr.y + 10);
    draw();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { canvas.addEventListener(ev, function () { drag = null; }); });

  // ---------- Controls ----------
  function bindChoice(name, fn) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) { fn(r.value); draw(); } });
    });
  }
  var hRoot = document.querySelector('[data-height-stepper]');
  function paintHint() { var n = hRoot && hRoot.querySelector('.hint'); if (n && FT.heightHint) n.textContent = FT.heightHint(state.height, state.fenceFt); }
  if (hRoot && FT.heightStepper) {
    var hCtl = FT.heightStepper(hRoot, function (v) { state.height = v; paintHint(); draw(); });
    var d = FT.store.get('draft', null);
    if (d && d.height) state.height = hCtl.set(FT.clampHeight(d.height));
    paintHint();
  }
  bindChoice('viz-color', function (v) { state.color = v; FT.store.set('color', v); });
  var colorInput = document.querySelector('input[name="viz-color"][value="' + state.color + '"]');
  if (colorInput) colorInput.checked = true;

  var fenceEl = document.getElementById('viz-fence');
  fenceEl.addEventListener('change', function () { state.fenceFt = Number(fenceEl.value) || 6; paintHint(); draw(); });
  var postsEl = document.getElementById('viz-posts');
  postsEl.addEventListener('input', function () { state.posts = Number(postsEl.value); document.getElementById('viz-posts-out').textContent = postsEl.value; draw(); });
  document.getElementById('viz-guides').addEventListener('change', function (e) { state.guides = e.target.checked; draw(); });
  var compare = document.getElementById('viz-compare');
  compare.addEventListener('click', function () {
    state.show = !state.show;
    compare.textContent = state.show ? 'Show before' : 'Show after';
    compare.setAttribute('aria-pressed', String(!state.show));
    draw();
  });
  document.getElementById('viz-reset').addEventListener('click', function () { state.h = defaultHandles(); draw(); });
  // Sample yards: the drawn illustration or a photo. The chosen one is marked pressed.
  var sampleBtns = Array.prototype.slice.call(document.querySelectorAll('[data-sample]'));
  function pressSample(id) { sampleBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sample === id)); }); }
  function useSample(id) {
    var s = SAMPLES[id];
    if (!s) { setPhoto(sampleYard(), true); pressSample('drawn'); return; }
    var img = new Image();
    img.onload = function () { img.fence = s.fence; setPhoto(img, true); pressSample(id); };
    img.onerror = function () { if (FT.toast) FT.toast('That sample didn’t load. Try again.'); };
    img.src = FT.link ? FT.link(s.src) : s.src;
  }
  var samplesBox = document.getElementById('viz-samples'), samplesToggle = document.getElementById('viz-samples-toggle');
  function showSamples(open) { samplesBox.hidden = !open; samplesToggle.setAttribute('aria-expanded', String(open)); }
  samplesToggle.addEventListener('click', function () { showSamples(samplesBox.hidden); });
  sampleBtns.forEach(function (b) { b.addEventListener('click', function () { useSample(b.dataset.sample); showSamples(false); }); });
  var drawnThumb = document.querySelector('[data-sample="drawn"] img');
  if (drawnThumb) { var tc = document.createElement('canvas'); tc.width = 240; tc.height = 150; tc.getContext('2d').drawImage(sampleYard(), 0, 0, 240, 150); drawnThumb.src = tc.toDataURL('image/png'); }

  var file = document.getElementById('viz-file');
  file.addEventListener('change', function () {
    var f = file.files && file.files[0];
    if (!f) return;
    var url = URL.createObjectURL(f);
    var img = new Image();
    img.onload = function () { setPhoto(img, false); pressSample(null); URL.revokeObjectURL(url); document.getElementById('viz-stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    img.onerror = function () { if (FT.toast) FT.toast('That file isn’t an image we can open. Try a JPG or PNG.'); };
    img.src = url;
  });

  document.getElementById('viz-save').addEventListener('click', function () {
    FT.store.set('color', state.color);
    FT.store.set('draft', Object.assign({}, FT.store.get('draft', { runs: [48], corners: 0 }), { height: state.height, color: state.color }));
  });

  window.addEventListener('resize', draw);
  setPhoto(sampleYard(), true); pressSample('drawn');
})();
