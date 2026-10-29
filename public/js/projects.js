/* FenceTopper project data for the preview: accounts, saved projects, states and the dated
   rate schedule. PREVIEW ONLY: everything lives in this browser's localStorage. Production
   keeps it on a server with real accounts, one-time codes and a database (docs/05). */
(function () {
  'use strict';
  var FT = window.FT;
  if (!FT) return;
  var store = FT.store;

  // ---------- States (docs/05: customer-facing states) ----------
  // tone: warn = customer owes the next step, info = FenceTopper does, ok = done, error = blocked on the customer.
  var STATES = {
    'estimate':        { badge: 'Estimate',         tone: 'warn',  next: 'Save your project', staff: 'Estimate draft' },
    'in-progress':     { badge: 'In progress',      tone: 'warn',  next: null, staff: 'Builder in progress' },
    'needs-fix':       { badge: 'Needs a fix',      tone: 'error', next: null, staff: 'Needs customer correction' },
    'submitted':       { badge: 'Submitted',        tone: 'info',  next: 'Nothing needed. We’re reviewing your measurements.', staff: 'Submitted for review' },
    'waiting':         { badge: 'Question for you', tone: 'warn',  next: 'Answer our question', staff: 'Waiting on customer' },
    'reply-received':  { badge: 'Reply received',   tone: 'info',  next: 'Nothing needed. We’re on it.', staff: 'Customer response received' },
    'designing':       { badge: 'Designing',        tone: 'info',  next: 'Nothing needed. We’re preparing your design.', staff: 'Prepare final design' },
    'awaiting-approval': { badge: 'Ready to approve', tone: 'warn', next: 'Review and approve your design', staff: 'Awaiting approval' },
    'deposit-due':     { badge: 'Deposit due',      tone: 'warn',  next: 'Pay your deposit', staff: 'Down payment due' },
    'scheduled':       { badge: 'Scheduled',        tone: 'info',  next: 'Nothing needed', staff: 'Ready for production' },
    'in-production':   { badge: 'Being built',      tone: 'info',  next: 'Nothing needed', staff: 'In production' },
    'quality':         { badge: 'Quality check',    tone: 'info',  next: 'Nothing needed', staff: 'Quality review' },
    'balance-due':     { badge: 'Balance due',      tone: 'warn',  next: 'Pay your balance to ship', staff: 'Final payment due' },
    'ready-to-ship':   { badge: 'Ready to ship',    tone: 'ok',    next: 'Nothing needed', staff: 'Ready to ship' },
    'shipped':         { badge: 'Shipped',          tone: 'ok',    next: 'Track your package', staff: 'Shipped' },
    'delivered':       { badge: 'Delivered',        tone: 'ok',    next: 'Install it', staff: 'Delivered' },
    'closed':          { badge: 'Complete',         tone: 'ok',    next: 'Share a photo (optional)', staff: 'Closed' },
  };
  var ORDER = Object.keys(STATES);
  function stateAtLeast(p, s) { return ORDER.indexOf(p.state) >= ORDER.indexOf(s); }

  // ---------- Dated rate schedule ----------
  // Each version has an effective date. The active version is the latest one whose date has arrived.
  // Version 1 is seeded from `pricing` in src/data/site.ts. Every estimate records the version it used.
  var RATE_FIELDS = [
    ['perSqFt', 'Per square foot of topper', '$'],
    ['perMiddlePost', 'Per middle post', '$'],
    ['perPanel', 'Per panel (one per run)', '$'],
    ['maxPostSpacingFt', 'Post spacing used to estimate middle posts', 'ft'],
    ['freeShippingOver', 'Free shipping on orders over', '$'],
  ];
  function today() { return new Date().toISOString().slice(0, 10); }
  function rateSchedule() {
    var list = store.get('rates', null);
    if (!list || !list.length) {
      var base = window.FT_PRICING || FT.PRICING;
      list = [Object.assign({ id: 'r1', version: 1, effective: '2026-10-22', note: 'Greg’s rates from site settings', by: 'System', createdAt: '2026-10-22T15:09:00Z' }, pick(base))];
      store.set('rates', list);
    }
    return list.slice().sort(function (a, b) { return a.effective < b.effective ? -1 : a.effective > b.effective ? 1 : a.version - b.version; });
  }
  function pick(r) { var o = {}; RATE_FIELDS.forEach(function (f) { o[f[0]] = Number(r[f[0]]); }); return o; }
  function activeRates(on) {
    on = on || today();
    var list = rateSchedule(), cur = list[0];
    list.forEach(function (r) { if (r.effective <= on) cur = r; });
    return cur;
  }
  function addRateVersion(values, effective, note, by) {
    var list = store.get('rates', []) || [];
    var v = list.reduce(function (m, r) { return Math.max(m, r.version); }, 0) + 1;
    var rec = Object.assign({ id: 'r' + v, version: v, effective: effective, note: note || '', by: by || 'Staff', createdAt: new Date().toISOString() }, pick(values));
    list.push(rec);
    store.set('rates', list);
    return rec;
  }
  // Use the active schedule for every quote on this device.
  function applyActiveRates() {
    var r = activeRates();
    Object.keys(pick(r)).forEach(function (k) { FT.PRICING[k] = r[k]; });
    return r;
  }

  // ---------- Projects ----------
  function all() { return (store.get('projects', []) || []).map(normalize); }
  function saveAll(list) { store.set('projects', list); }
  function get(id) { return all().filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function save(p) {
    p.updatedAt = new Date().toISOString();
    var list = all(), i = list.findIndex(function (x) { return String(x.id) === String(p.id); });
    if (i >= 0) list[i] = p; else list.push(p);
    saveAll(list);
    return p;
  }
  function log(p, who, text) { (p.activity = p.activity || []).push({ at: new Date().toISOString(), who: who, text: text }); }

  // ---------- What the extensions mount on, and extension fit (guided Builder) ----------
  // Greg, 2026-10-23: ask what the extension mounts on, not the fence type (galvanized posts show up on wood fences too).
  // fit: proven = galvanized pipe solutions we've designed for; planning = needs installation planning;
  // review = we review the customer's own design. Never imply instructions we haven't validated.
  var BASES = [
    { id: 'round', name: 'Round metal posts', hint: 'Galvanized or steel posts, on any kind of fence', recommend: ['ozco', 'swaged-galv', 'swaged-black'] },
    { id: 'square', name: 'Square metal posts', hint: 'Steel or aluminum square posts', recommend: [] },
    { id: 'wood', name: 'Wood posts', hint: 'Fastened to the side or face of each post', recommend: ['side-pipe', 'outdeco'] },
    { id: 'rail', name: 'A top rail or wall', hint: 'Mounted directly to a solid top rail or a concrete or masonry wall', recommend: ['outdeco'] },
  ];
  var EXT_FIT = {
    ozco: { fit: 'proven', shape: 'Round', size: 2.375 },
    'swaged-galv': { fit: 'proven', shape: 'Round', size: null },
    'swaged-black': { fit: 'proven', shape: 'Round', size: 1.625 },
    outdeco: { fit: 'planning', shape: 'Square', size: 1 },
    'side-pipe': { fit: 'planning', shape: '', size: null },
    custom: { fit: 'review', shape: '', size: null },
  };
  // Actual outside sizes in inches.
  var POST_SIZES = {
    Round: [[1.625, '1 5/8 in'], [1.875, '1 7/8 in'], [2.375, '2 3/8 in'], [2.875, '2 7/8 in'], [3.5, '3 1/2 in'], [4, '4 in']],
    Square: [[1, '1 in'], [1.5, '1 1/2 in'], [2, '2 in'], [2.5, '2 1/2 in'], [3, '3 in'], [3.5, '3 1/2 in (a 4x4)'], [4, '4 in']],
  };
  function sizeLabel(spec) {
    if (!spec || !spec.shape || !spec.size) return '';
    var hit = (POST_SIZES[spec.shape] || []).filter(function (x) { return x[0] === Number(spec.size); })[0];
    return spec.shape + ' ' + (hit ? hit[1] : spec.size + ' in');
  }
  function method(p) { var s = p.setup; return s.extStatus === 'installed' || (s.extStatus === 'custom' && s.customInstalled) ? 'gap' : 'center'; }
  // The spec that applies to a post: its own override, else the project's end or middle spec.
  function postSpec(p, r, k) {
    var post = r.posts[k];
    return post.spec || p.setup.post;
  }
  // Center-to-center length between the end posts, or null while measurements are missing.
  function runLength(p, r) {
    if (!r.spans.length || r.spans.some(function (x) { return !(x > 0); })) return null;
    var sum = r.spans.reduce(function (a, b) { return a + b; }, 0);
    if (method(p) === 'center') return sum;
    var widths = r.posts.map(function (_, k) { var sp = postSpec(p, r, k); return sp && sp.size ? Number(sp.size) * 4 : null; });
    if (widths.some(function (w) { return w == null; })) return null;
    for (var k = 0; k < r.spans.length; k++) sum += (widths[k] + widths[k + 1]) / 2;
    return Math.round(sum);
  }
  function runHeight(p, r) { return p.setup.sameHeight === 'no' && r.height ? r.height : p.height; }
  function runColor(p) { return p.color; } // one fabric color per project
  function runExtender(p, r) { return r.extender || p.setup.extender; }

  // ---------- Normalize (Shop projects, older Builder projects) ----------
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  function normalize(p) {
    p.state = p.state || 'in-progress';
    p.name = p.name || 'My FenceTopper';
    p.createdAt = p.createdAt || new Date(typeof p.id === 'number' ? p.id : Date.now()).toISOString();
    p.updatedAt = p.updatedAt || p.createdAt;
    p.messages = p.messages || [];
    p.activity = p.activity || [{ at: p.createdAt, who: 'You', text: 'Saved the project from Shop' }];
    p.estimates = p.estimates || [];
    if (!p.estimates.length && p.estimate != null) {
      p.estimates.push({ at: p.createdAt, total: p.estimate, rateVersion: p.rateVersion || 1, rates: p.rates || null, source: 'Shop' });
    }
    p.shipping = p.shipping || { name: '', street: '', city: '', state: '', zip: '' };
    p.questions = p.questions || [];
    p.files = p.files || {};
    p.setup = Object.assign({ extStatus: '', base: '', extender: '', helpExt: false, decideLater: false, customDesc: '', customInstalled: false, designer: '',
      post: { shape: '', size: '' }, sameHeight: 'yes', topperAnswered: false }, p.setup || {});
    var s0 = p.setup; // projects from the first guided Builder asked for the fence type
    if (!s0.base && s0.fenceType) s0.base = { chain: 'round', wood: 'wood', 'wood-rail': 'rail' }[s0.fenceType] || '';
    if (s0.sameStyle && !s0.topperAnswered) { s0.sameHeight = s0.sameStyle; s0.topperAnswered = !!s0.styleAnswered; }
    if (!p.setup.extender && p.extender && p.extender.id) p.setup.extender = p.extender.id; // chosen on the Fence extenders page
    if (!p.runs) p.runs = (p.runQin || []).map(function (q) { return blankRun(q); });
    if (!p.runs.length) p.runs.push(blankRun(48 * 40));
    p.runs = p.runs.map(function (r) { return Array.isArray(r.posts) ? r : fromOldRun(r); });
    p.runs.forEach(function (r, i) { r.id = r.id || uid(); r.name = r.name || 'Run ' + (i + 1); r.unsure = r.unsure || []; r.photos = r.photos || {}; });
    return p;
  }
  function blankRun(qin, name) {
    var mids = Math.max(0, Math.ceil(qin / (48 * (FT.PRICING.maxPostSpacingFt || 15))) - 1);
    var posts = [{ id: uid(), kind: 'end', spec: null }];
    for (var k = 0; k < mids; k++) posts.push({ id: uid(), spec: null });
    posts.push({ id: uid(), kind: 'end', spec: null });
    return { id: uid(), name: name || '', qin: qin, posts: posts, spans: posts.slice(1).map(function () { return null; }), unsure: [], height: null, color: null, extender: null, photos: {}, notes: '' };
  }
  function fromOldRun(r) {
    var n = Math.max(2, Number(r.posts) || 2), nr = blankRun(r.qin);
    nr.posts = Array.from({ length: n }, function (_, k) { return { id: uid(), kind: k === 0 || k === n - 1 ? 'end' : undefined, spec: null }; });
    nr.spans = Array.from({ length: n - 1 }, function (_, k) { return r.spans && r.spans[k] > 0 ? r.spans[k] : null; });
    nr.photos = r.photos || {}; nr.notes = r.notes || '';
    return nr;
  }

  // ---------- What's still needed (B6) ----------
  // level 'needed': must be resolved before we can manufacture. level 'review': we'll work it out with you.
  function requirements(p) {
    var s = p.setup, items = [], E = function (id) { return EXT_FIT[id] || {}; };
    var add = function (level, label, where, field) { items.push({ level: level, label: label, where: where, field: field }); };
    if (!s.extStatus) add('needed', 'Tell us about your extensions', 'setup', 'q-ext');
    if (!s.base) add('needed', 'Tell us what the extensions mount on', 'setup', 'q-base');
    if (s.extStatus === 'undecided') {
      if (s.helpExt) add('review', 'Help choosing an extension', 'setup', 'q-choose');
      else add('needed', 'Choose an extension (you can decide later)', 'setup', 'q-choose');
    } else if (s.extStatus) {
      if (s.extStatus === 'custom') {
        if (!s.customDesc) add('needed', 'Describe your extension design', 'setup', 'q-choose');
        add('review', 'We’ll review your custom extension design', 'setup', 'q-choose');
      }
      if (!(s.post.shape && s.post.size)) add('needed', 'Extension shape and size', 'setup', 'q-choose');
    }
    if (s.base === 'square' || s.base === 'rail') add('review', 'Installation planning for ' + (s.base === 'rail' ? 'a top rail or wall' : 'square metal posts'), 'setup', 'q-base');
    var ids = [s.extender].concat(p.runs.map(function (r) { return r.extender; })).filter(Boolean);
    ids.filter(function (id, i) { return ids.indexOf(id) === i && E(id).fit === 'planning'; }).forEach(function (id) {
      add('review', 'Installation planning for your ' + extName(id), 'setup', 'q-choose');
    });
    p.runs.forEach(function (r, i) {
      var missing = r.spans.filter(function (x, k) { return !(x > 0) && !r.unsure[k]; }).length;
      var unsure = r.spans.filter(function (x, k) { return !(x > 0) && r.unsure[k]; }).length;
      if (missing) add('needed', r.name + ': ' + missing + ' measurement' + (missing === 1 ? '' : 's') + ' to enter', i, 'run-' + i + '-seq');
      if (unsure) add('needed', r.name + ': ' + unsure + ' measurement' + (unsure === 1 ? '' : 's') + ' marked “not sure”', i, 'run-' + i + '-seq');
      var odd = r.posts.filter(function (x) { return x.spec && !(x.spec.shape && x.spec.size); }).length;
      if (odd) add('needed', r.name + ': size of ' + odd + ' post' + (odd === 1 ? '' : 's') + ' marked different', i, 'run-' + i + '-seq');
      if (r.extender && E(r.extender).fit === 'review') add('review', r.name + ': custom extension review', i, 'run-' + i + '-more');
    });
    var needed = items.filter(function (x) { return x.level === 'needed'; }).length;
    return { items: items, needed: needed, review: items.length - needed, open: needed };
  }
  function extName(id) { var o = (window.FT_EXTENDERS || []).filter(function (x) { return x.id === id; })[0]; return o ? o.name : id; }
  function photoSlots() {
    return [{ id: 'overview', name: 'Whole run', req: 'Recommended' }, { id: 'left', name: 'Left end post', req: 'Recommended' }, { id: 'right', name: 'Right end post', req: 'Recommended' }, { id: 'other', name: 'Anything unusual', req: 'Optional' }];
  }
  function shippingDone(p) { var s = p.shipping; return !!(s.name && s.street && s.city && s.state && s.zip); }

  // ---------- Estimate with the active rates, recorded with its rate version ----------
  function estimate(p) {
    var r = applyActiveRates();
    var lens = p.runs.map(function (x) { return runLength(p, x) || x.qin; });
    var area = 0, sqft = 0;
    p.runs.forEach(function (x, i) { var q = FT.quote({ runQin: [lens[i]], height: runHeight(p, x) }); area += q.area; sqft += q.sqft; });
    var middle = p.runs.reduce(function (a, x) { return a + Math.max(0, x.posts.length - 2); }, 0);
    var postCost = middle * r.perMiddlePost, panels = p.runs.length, build = panels * r.perPanel;
    var total = Math.round((area + postCost + build) * 100) / 100;
    return { sqft: sqft, area: area, middle: middle, postCost: postCost, panels: panels, build: build, total: total, rateVersion: r.version, rates: pick(r), freeShipping: total >= r.freeShippingOver };
  }
  function recordEstimate(p, source) {
    var e = estimate(p);
    p.estimates.push({ at: new Date().toISOString(), total: e.total, rateVersion: e.rateVersion, rates: e.rates, source: source });
    return e;
  }

  // ---------- Demo projects so the staff queue has something in it ----------
  function seedDemo() {
    if (store.get('demoSeeded3', false)) return;
    var list = (store.get('projects', []) || []).filter(function (x) { return !x.demo; });
    var now = Date.now(), day = 86400000;
    function demo(id, name, first, last, state, runs, height, color, ageDays, extra) {
      var p = normalize({ id: id, name: name, first: first, last: last, email: first.toLowerCase() + '@example.com', state: state, height: height, color: color,
        runQin: runs, createdAt: new Date(now - ageDays * day).toISOString(), demo: true });
      p.updatedAt = new Date(now - Math.max(0, ageDays - 1) * day).toISOString();
      Object.assign(p, extra || {});
      var e = estimate(p);
      p.estimates = [{ at: p.createdAt, total: e.total, rateVersion: e.rateVersion, rates: e.rates, source: 'Shop' }];
      return p;
    }
    var chain = { base: 'round', extStatus: 'installed', extender: 'ozco', post: { shape: 'Round', size: 2.375 }, sameHeight: 'yes', topperAnswered: true };
    var a = demo('demo-1', 'Maple Street', 'Dana', 'Reyes', 'submitted', [40 * 48, 18 * 48 + 12], 18, 'carbon', 3);
    a.setup = Object.assign(a.setup, chain);
    a.runs[0].spans = a.runs[0].spans.map(function () { return 13 * 48 + 14; });
    a.runs[1].spans = a.runs[1].spans.map(function (_, k, arr) { return Math.round((18 * 48 + 12) / arr.length) - 10; });
    a.runs[1].posts[0].kind = 'corner';
    a.runs.forEach(function (r) { r.photos = { overview: 'overview.jpg', left: 'left.jpg', right: 'right.jpg' }; });
    a.shipping = { name: 'Dana Reyes', street: '214 Maple St', city: 'Portland', state: 'OR', zip: '97214' };
    a.activity.push({ at: new Date(now - 2 * day).toISOString(), who: 'Dana', text: 'Submitted for review' });
    var b = demo('demo-2', 'Cedar Court', 'Sam', 'Okafor', 'waiting', [24 * 48], 24, 'evergreen', 6, {
      questions: [{ run: 0, field: 'Right end post', text: 'Your photo of the right end post is blurry. Could you add a clearer one?', at: new Date(now - 4 * day).toISOString() }] });
    b.setup = Object.assign(b.setup, { base: 'wood', extStatus: 'undecided', helpExt: true, topperAnswered: true });
    var c = demo('demo-3', 'Birch Lane', 'Priya', 'Shah', 'awaiting-approval', [32 * 48 + 6], 12, 'black', 9, {
      finalDesign: { version: 2, date: new Date(now - day).toISOString().slice(0, 10), price: 0 } });
    c.setup = Object.assign(c.setup, chain);
    c.finalDesign.price = estimate(c).total + 35;
    var d = demo('demo-4', 'Oak Ridge', 'Lee', 'Martin', 'in-production', [55 * 48], 20, 'brown', 21);
    d.setup = Object.assign(d.setup, chain);
    var e = demo('demo-5', 'Willow Way', 'Jordan', 'Kim', 'reply-received', [16 * 48, 16 * 48], 18, 'carbon', 5);
    e.setup = Object.assign(e.setup, { base: 'rail', extStatus: 'custom', customDesc: 'Black 1 in square steel tube bolted to the inside face of the top rail, rising 20 in.', designer: 'contractor', post: { shape: 'Square', size: 1 }, topperAnswered: true });
    saveAll(list.concat([a, b, c, d, e]));
    store.set('demoSeeded3', true);
  }

  // ---------- Session (preview sign-in) ----------
  function session() { return store.get('session', null); }
  function signIn(contact) { store.set('session', { email: contact.email || '', mobile: contact.mobile || '', first: contact.first || '', at: new Date().toISOString() }); }
  function signOut() { store.set('session', null); }
  function mine() {
    var s = session(); if (!s) return [];
    return all().filter(function (p) { return !p.demo && (!p.email || !s.email || p.email.toLowerCase() === s.email.toLowerCase()); });
  }

  function badge(state) {
    var st = STATES[state] || STATES['in-progress'];
    var icon = { warn: '!', info: 'i', ok: '✓', error: '×' }[st.tone];
    return '<span class="state-badge ' + st.tone + '"><span class="state-dot" aria-hidden="true">' + icon + '</span>' + st.badge + '</span>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(iso) { var d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function ageDays(iso) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }

  applyActiveRates();
  FT.projects = {
    STATES: STATES, stateAtLeast: stateAtLeast, all: all, get: get, save: save, log: log, normalize: normalize,
    requirements: requirements, photoSlots: photoSlots, estimate: estimate, recordEstimate: recordEstimate, shippingDone: shippingDone,
    BASES: BASES, EXT_FIT: EXT_FIT, POST_SIZES: POST_SIZES, sizeLabel: sizeLabel, method: method, postSpec: postSpec, runLength: runLength,
    runHeight: runHeight, runColor: runColor, runExtender: runExtender, blankRun: blankRun, extName: extName, uid: uid,
    rateSchedule: rateSchedule, activeRates: activeRates, addRateVersion: addRateVersion, applyActiveRates: applyActiveRates, RATE_FIELDS: RATE_FIELDS, today: today,
    seedDemo: seedDemo, session: session, signIn: signIn, signOut: signOut, mine: mine,
    badge: badge, esc: esc, when: when, ageDays: ageDays,
  };
})();
