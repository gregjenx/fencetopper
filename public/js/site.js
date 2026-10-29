/* FenceTopper site script: menu, cart, quote math and the help chat.
   No framework; every page loads this one file. */
(function () {
  'use strict';

  // Turns a site path into a link. The static preview swaps this for .html links.
  var link = function (p) { return window.FT_LINK ? window.FT_LINK(p) : p; };

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('ft:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ft:' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };

  // ---------- Quote math (rates come from `pricing` in src/data/site.ts, written into each page as FT_PRICING) ----------
  var PRICING = window.FT_PRICING || {};

  // Estimate preview: topper area x $/sq ft + estimated middle posts x $ each + panels (one per run) x $ each.
  // cfg.runQin: run lengths in integer quarter-inches (cfg.runs in decimal feet is the older format).
  // Middle posts per run are estimated from length: max(0, ceil(ft / maxPostSpacingFt) - 1).
  // The count isn't shown to customers; only its dollar amount is. Money is kept in cents until the end.
  function quote(cfg) {
    var P = PRICING, h = clampHeight(cfg.height);
    var qin = cfg.runQin ? cfg.runQin.map(Number) : (cfg.runs || []).map(function (f) { return Math.round(Number(f) * 48); });
    var totalQin = 0, panels = 0, posts = 0;
    qin.forEach(function (q, i) {
      if (!(q > 0)) return;
      totalQin += q; panels++;
      posts += Math.max(0, Math.ceil(q / (48 * P.maxPostSpacingFt)) - 1);
    });
    var sqft = totalQin * h / 576; // (qin / 48 ft) x (h / 12 ft)
    var areaC = Math.round(totalQin * h * P.perSqFt * 100 / 576);
    var postC = posts * P.perMiddlePost * 100, panelC = panels * P.perPanel * 100;
    return { feet: totalQin / 48, totalQin: totalQin, sqft: sqft, panels: panels, posts: posts,
      area: areaC / 100, postCost: postC / 100, build: panelC / 100, total: (areaC + postC + panelC) / 100, height: h, color: cfg.color };
  }
  var HEIGHT = { min: 12, max: 24, def: 18 };
  function clampHeight(h) { h = Math.round(Number(h)); return h >= HEIGHT.min && h <= HEIGHT.max ? h : HEIGHT.def; }
  // "An 18 in topper on a 6 ft fence makes it 7 ft 6 in."
  function heightHint(h, fenceFt) {
    fenceFt = fenceFt || 6;
    var total = fenceFt * 12 + h, ft = Math.floor(total / 12), inch = total % 12;
    return (h === 18 ? 'An ' : 'A ') + h + ' in topper on a ' + fenceFt + ' ft fence makes it ' + ft + ' ft' + (inch ? ' ' + inch + ' in' : '') + '.';
  }
  // Wires a .height-stepper: minus / number / plus, 12 to 24 in, 1 in steps.
  function heightStepper(root, onChange) {
    var input = root.querySelector('input'), hint = root.querySelector('.hint');
    var minus = root.querySelector('[data-hstep="-1"]'), plus = root.querySelector('[data-hstep="1"]');
    function set(v, fire) {
      v = Math.min(HEIGHT.max, Math.max(HEIGHT.min, Math.round(Number(v)) || HEIGHT.def));
      input.value = v;
      minus.disabled = v <= HEIGHT.min; plus.disabled = v >= HEIGHT.max;
      if (hint) hint.textContent = heightHint(v);
      if (fire && onChange) onChange(v);
      return v;
    }
    minus.addEventListener('click', function () { set(Number(input.value) - 1, true); });
    plus.addEventListener('click', function () { set(Number(input.value) + 1, true); });
    input.addEventListener('change', function () { set(input.value, true); });
    set(input.value, false);
    return { set: function (v) { return set(v, false); }, get: function () { return Number(input.value); } };
  }
  // $740 or $1,234.50: cents only when there are any.
  var money = function (n) { n = Math.round(n * 100) / 100; return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  // 581 (inches) -> "48 ft 5 in"
  function fmtLen(total) {
    total = Math.round(total);
    var ft = Math.floor(total / 12), inch = total % 12;
    return ft ? ft + ' ft' + (inch ? ' ' + inch + ' in' : '') : inch + ' in';
  }

  // ---------- Cart ----------
  function cart() { return store.get('cart', []); }
  function setCart(items) { store.set('cart', items); paintCount(); }
  function paintCount() {
    var n = cart().length;
    document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = n; el.hidden = n === 0; });
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  window.FT = { link: link, store: store, quote: quote, clampHeight: clampHeight, heightHint: heightHint, heightStepper: heightStepper, money: money, fmtLen: fmtLen, cart: cart, setCart: setCart, toast: toast, PRICING: PRICING };

  // ---------- Mobile menu ----------
  var toggle = document.querySelector('[data-menu-toggle]');
  var mnav = document.getElementById('mobile-nav');
  if (toggle && mnav) {
    toggle.addEventListener('click', function () {
      var open = mnav.hidden;
      mnav.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ---------- Color swatches (any [data-swatches] group) ----------
  document.querySelectorAll('[data-swatches]').forEach(function (group) {
    var target = document.querySelector(group.getAttribute('data-swatches'));
    group.querySelectorAll('.swatch').forEach(function (b) {
      b.addEventListener('click', function () {
        group.querySelectorAll('.swatch').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        if (target) target.style.backgroundColor = b.dataset.hex;
        store.set('color', b.dataset.color);
      });
    });
  });

  // ---------- Help chat ----------
  // Answers come from kb.json (the FAQ). A guided flow handles measuring and pricing.
  // PLACEHOLDER: production can route free-text questions to an AI model with the
  // same knowledge base as context; this version runs entirely in the browser.
  var KB = null;
  function loadKB() {
    if (KB) return Promise.resolve(KB);
    return fetch('kb.json').then(function (r) { return r.json(); }).then(function (d) { KB = d; return d; })
      .catch(function () { KB = { faqs: [] }; return KB; });
  }
  var STOP = 'a an the i my me is it do does can how what will to of for on in and or with you your be are this that'.split(' ');
  function words(s) { return s.toLowerCase().replace(/[^a-z0-9$ ]/g, ' ').split(/\s+/).filter(function (w) { return w && STOP.indexOf(w) < 0; }); }
  function bestAnswer(q) {
    var qw = words(q), low = q.toLowerCase(), best = null, bestScore = 0;
    (KB.faqs || []).forEach(function (f) {
      var s = 0;
      f.tags.forEach(function (t) { if (low.indexOf(t) >= 0) s += 3; });
      var fw = words(f.q);
      qw.forEach(function (w) { if (fw.indexOf(w) >= 0) s += 1; });
      if (s > bestScore) { bestScore = s; best = f; }
    });
    return bestScore >= 2 ? best : null;
  }
  var RELATED = { measure: ['/measure', 'Open the measuring guide'], install: ['/install', 'See the installation guide'], price: ['/shop', 'Build your price'], cost: ['/shop', 'Build your price'], color: ['/visualizer', 'Try colors on your fence'], height: ['/visualizer', 'Preview heights on your fence'], tall: ['/visualizer', 'Preview heights on your fence'], corner: ['/product', 'See how it’s built'] };

  function Chat(root) {
    this.log = root.querySelector('[data-chat-log]');
    this.chips = root.querySelector('[data-chat-chips]');
    this.form = root.querySelector('[data-chat-form]');
    this.input = this.form.querySelector('input');
    this.flow = null;
    this.started = false;
    var self = this;
    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = self.input.value.trim();
      if (!v) return;
      self.input.value = '';
      self.user(v);
    });
  }
  Chat.prototype.say = function (html, who) {
    var m = document.createElement('div');
    m.className = 'msg ' + (who || 'bot');
    if (who === 'me') m.textContent = html; else m.innerHTML = html;
    this.log.appendChild(m);
    this.log.scrollTop = this.log.scrollHeight;
  };
  Chat.prototype.setChips = function (list) {
    var self = this;
    this.chips.innerHTML = '';
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = c;
      b.addEventListener('click', function () { self.user(c); });
      self.chips.appendChild(b);
    });
  };
  Chat.prototype.start = function () {
    if (this.started) return;
    this.started = true;
    this.say('Hi! I can help you measure your fence, pick a height and color, price your order, or walk through installation. What would you like to do?');
    this.setChips(['Help me measure', 'Choose my topper', 'Installation help', 'Get my price']);
    loadKB();
  };
  Chat.prototype.user = function (text) {
    var self = this;
    this.say(text, 'me');
    loadKB().then(function () { setTimeout(function () { self.respond(text); }, 250); });
  };
  Chat.prototype.respond = function (text) {
    var t = text.toLowerCase(), num = parseFloat(t.replace(/[^0-9.]/g, ''));
    var f = this.flow;
    if (f && f.step === 'feet') {
      if (num > 0) { f.feet = num; f.step = 'height';
        this.say('Got it, ' + num + ' ft. Which height do you want, from 12 to 24 in? Most people pick 18 in, which turns a 6 ft fence into 7 ft 6 in.');
        return this.setChips(['12 in', '18 in', '24 in']); }
      return this.say('Please enter the total length in feet, for example 48.');
    }
    if (f && f.step === 'height') {
      var h = num >= 12 && num <= 24 && num === Math.round(num) ? num : null;
      if (!h) return this.say('Choose a whole number of inches from 12 to 24.');
      f.height = h;
      var q = quote({ runs: [f.feet], height: h });
      store.set('draft', { runs: [f.feet], height: h, color: store.get('color', 'carbon') });
      this.flow = null;
      this.say('Here’s an estimate for ' + f.feet + ' ft at ' + h + ' in: <strong>' + money(q.total) + '</strong> before shipping. ' +
        'That’s ' + (Math.round(q.sqft * 100) / 100) + ' sq ft × $' + PRICING.perSqFt + ', ' + money(q.postCost) + ' for the estimated middle posts and 1 panel × $' + PRICING.perPanel + '.<br>' +
        'If your fence turns a corner or steps up or down, enter each part as its own run. <a href="' + link('/shop') + '">Open this in the price builder</a> to add your exact runs, pick a color and build your topper.');
      return this.setChips(['Choose my topper', 'Installation help', 'Talk to a person']);
    }
    if (/help me measure|measur/.test(t) && !/how do i measure|guide/.test(t)) {
      this.flow = { step: 'feet' };
      this.say('Let’s measure. Walk the fence you want to cover and measure each straight, level run, end post to end post. Skip gates. About how many feet is that in total?');
      return this.setChips(['24', '48', '80', '120']);
    }
    if (/get my price|price|cost|quote|how much/.test(t)) {
      this.flow = { step: 'feet' };
      this.say('I can price it now. How many feet of fence do you want to cover?');
      return this.setChips(['24', '48', '80', '120']);
    }
    if (/choose my topper|choose|which|recommend/.test(t)) {
      this.say('Two choices: <strong>height</strong> and <strong>color</strong>. Height is any whole inch from 12 to 24. 18 in suits most 6 ft fences; go lower for a low sightline and higher to screen a deck or upstairs window. Carbon is our most popular color, Brown pairs well with cedar and Evergreen blends into planting. <a href="' + link('/visualizer') + '">Try them on a photo of your fence</a>.');
      return this.setChips(['What does 24 in look like?', 'Get my price', 'Will it sag?']);
    }
    if (/install/.test(t) && !/how long/.test(t)) {
      this.say('Installation takes basic tools: tape measure, drill, level. 1) Install your fence extenders (see the options on our <a href="' + link('/fence-extenders') + '">Fence extenders page</a>). 2) Slide the panel pockets over the inner posts. 3) Wrap the end straps around the outer posts and pull them through the fasteners. 4) Set the height with a screw at each center post. 5) Press the end covers onto the Velcro strip. <a href="' + link('/install') + '">Full installation guide</a>');
      return this.setChips(['What tools do I need?', 'How does it handle corners?', 'Talk to a person']);
    }
    if (/person|human|agent|call|email|contact/.test(t)) {
      return this.say('You can reach our team at <strong>' + (KB.email || 'support@fencetopper.com') + '</strong> or through the <a href="' + link('/contact') + '">contact form</a>. Include a photo of your fence and we’ll reply with a recommendation.');
    }
    var a = bestAnswer(text);
    if (a) {
      var extra = '';
      for (var k in RELATED) { if (t.indexOf(k) >= 0) { extra = ' <a href="' + link(RELATED[k][0]) + '">' + RELATED[k][1] + '</a>'; break; } }
      this.say(a.a + extra);
      return;
    }
    this.say('I don’t have a good answer for that yet. Try asking about measuring, heights, colors, corners, wind or installation, or <a href="' + link('/contact') + '">send our team a message</a>.');
    this.setChips(['Help me measure', 'Choose my topper', 'Installation help']);
  };

  var chats = [];
  document.querySelectorAll('[data-chat]').forEach(function (el) { chats.push({ el: el, chat: new Chat(el) }); });
  chats.forEach(function (c) { if (c.el.dataset.chat === 'inline') c.chat.start(); });
  var panel = chats.filter(function (c) { return c.el.dataset.chat === 'panel'; })[0];
  var launcher = document.querySelector('[data-chat-open]');
  function openPanel(prefill) {
    if (!panel) return;
    panel.el.hidden = false; if (launcher) launcher.hidden = true;
    panel.chat.start();
    if (prefill) panel.chat.user(prefill);
    panel.chat.input.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-chat-open]').forEach(function (b) {
    b.addEventListener('click', function () { openPanel(b.dataset.chatPrompt); });
  });
  document.querySelectorAll('[data-chat-close]').forEach(function (b) {
    b.addEventListener('click', function () { panel.el.hidden = true; if (launcher) launcher.hidden = false; });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel && !panel.el.hidden) { panel.el.hidden = true; if (launcher) launcher.hidden = false; } });

  paintCount();
})();
