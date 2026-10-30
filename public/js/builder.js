/* Guided Builder (docs/05, reworked 2026-10-23 from Greg's brief).
   Three stages: 1 Your fence (project-wide answers and defaults), 2 Runs (walk each run left to right,
   posts and measurements, exceptions only), 3 Review and submit. Payment comes after approval.
   PREVIEW ONLY: the project is read from and saved to this browser (see projects.js). */
(function () {
  'use strict';
  var FT = window.FT, P = FT && FT.projects;
  var root = document.getElementById('builder');
  if (!root || !P) return;
  P.seedDemo();
  document.body.classList.add('is-builder');
  var EXT = window.FT_EXTENDERS || [];
  var COLOR_NAMES = window.FT_COLOR_NAMES || {};
  var HEIGHTS = window.FT_HEIGHTS || [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
  var FRACTIONS = ['', '1/4', '1/2', '3/4'];
  var esc = P.esc;

  // ---------- Load ----------
  function hashParam(k) { return decodeURIComponent((location.hash.match(new RegExp('[#&]' + k + '=([^&]+)')) || [])[1] || ''); }
  var p = hashParam('p') ? P.get(hashParam('p')) : null;
  if (!p) {
    var mine = P.mine().sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    p = mine[0] || null;
  }
  if (!p) {
    root.innerHTML = '<section class="section-tight"><div class="panel empty-state"><h1>We couldn’t find that project</h1>' +
      '<p class="muted">Sign in to see your projects, or start a new one from your fence measurements.</p>' +
      '<div class="ext-cta"><a class="btn btn-primary" href="' + FT.link('/account') + '">Sign in</a><a class="btn btn-outline" href="' + FT.link('/shop') + '">Start a new project</a></div></div></section>';
    return;
  }
  var S = p.setup;
  var EDITABLE = ['estimate', 'in-progress', 'needs-fix'];
  function editable() { return EDITABLE.indexOf(p.state) >= 0; }

  var tab = 'build';
  var stage = hashParam('s') || (editable() ? 'project' : 'review');
  if (stage === 'setup' || stage === 'runs') stage = 'project'; // older links
  var runIdx = Math.min(p.runs.length - 1, Math.max(0, Number(hashParam('r')) || 0));
  var editingQ = null, armedDelete = null, addingRun = false, openPost = {};
  var saveTimer = null, savedAt = null, rendering = false;

  // ---------- Formatting ----------
  function fmtQin(q) {
    q = Math.max(0, Math.round(q || 0));
    var ft = Math.floor(q / 48), inch = Math.floor((q % 48) / 4), frac = q % 4;
    var inPart = (inch || frac) ? (inch ? inch : '') + (frac ? (inch ? ' ' : '') + FRACTIONS[frac] : '') + ' in' : '';
    if (!ft) return inPart || '0 in';
    return ft + ' ft' + (inPart ? ' ' + inPart : '');
  }
  function postName(r, k) { var n = r.posts.length; return k === 0 ? 'Left end' : k === n - 1 ? 'Right end' : 'Middle ' + k; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  var KINDS = [['end', 'Fence end'], ['corner', 'Corner'], ['gate', 'Gate'], ['wall', 'Wall or building']];
  var FIT = {
    proven: ['ok', '✓', 'Proven fit', 'We’ve designed toppers for this extension.'],
    planning: ['warn', '!', 'Needs planning', 'We’ll plan the installation with you during review. Installation steps for this aren’t finalized yet.'],
    review: ['info', 'i', 'We’ll review', 'We’ll review your design before we build. This isn’t an engineering approval.'],
  };
  function fitTag(id) { var f = FIT[(P.EXT_FIT[id] || {}).fit || 'review']; return '<span class="fit-tag ' + f[0] + '"><span aria-hidden="true">' + f[1] + '</span> ' + f[2] + '</span>'; }
  function baseName(id) { var f = P.BASES.filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; }
  function extById(id) { return EXT.filter(function (x) { return x.id === id; })[0]; }
  function dis() { return editable() ? '' : ' disabled'; }

  // ---------- Controls ----------
  function mi(key, qin, legend) {
    var ft = qin ? Math.floor(qin / 48) : '', inch = qin ? Math.floor((qin % 48) / 4) : '', fr = qin ? qin % 4 : 0;
    return '<fieldset class="measure-input" data-mi="' + key + '"><legend class="sr-only">' + legend + '</legend><div class="measure-fields">' +
      '<div class="unit-input"><label class="sr-only" for="' + key + '-ft">' + legend + ', feet</label><input id="' + key + '-ft" data-part="ft" type="number" min="0" max="999" inputmode="numeric" placeholder="0" value="' + ft + '"' + dis() + ' /><span aria-hidden="true">ft</span></div>' +
      '<div class="unit-input"><label class="sr-only" for="' + key + '-in">' + legend + ', inches</label><input id="' + key + '-in" data-part="in" type="number" min="0" max="11" inputmode="numeric" placeholder="0" value="' + inch + '"' + dis() + ' /><span aria-hidden="true">in</span></div>' +
      '<div><label class="sr-only" for="' + key + '-fr">' + legend + ', fraction of an inch</label><select id="' + key + '-fr" data-part="fr"' + dis() + '>' +
      FRACTIONS.map(function (f, i) { return '<option value="' + i + '"' + (i === fr ? ' selected' : '') + '>' + (f || '0') + '</option>'; }).join('') +
      '</select></div></div></fieldset>';
  }
  function readMi(fs) {
    var n = function (part) { return Math.max(0, Math.floor(Number(fs.querySelector('[data-part="' + part + '"]').value) || 0)); };
    return n('ft') * 48 + n('in') * 4 + n('fr');
  }
  // Big tappable options. opts: [value, title, description]
  function options(bind, value, opts, cls) {
    return '<div class="opt-list ' + (cls || '') + '" role="radiogroup">' + opts.map(function (o) {
      var id = bind.replace(/\./g, '-') + '-' + o[0];
      return '<label class="opt" for="' + id + '"><input id="' + id + '" type="radio" name="' + bind + '" value="' + esc(o[0]) + '" data-bind="' + bind + '"' + (String(value) === String(o[0]) ? ' checked' : '') + dis() + ' />' +
        '<span><strong>' + o[1] + '</strong>' + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</span></label>';
    }).join('') + '</div>';
  }
  function chips(bind, value, opts) {
    return '<div class="chip-row" role="radiogroup">' + opts.map(function (o) {
      var id = bind.replace(/\./g, '-') + '-' + o[0];
      return '<label class="chip-opt" for="' + id + '"><input id="' + id + '" type="radio" name="' + bind + '" value="' + esc(o[0]) + '" data-bind="' + bind + '"' + (String(value) === String(o[0]) ? ' checked' : '') + dis() + ' /><span>' + o[1] + '</span></label>';
    }).join('') + '</div>';
  }
  function textField(bind, label, value, o) {
    o = o || {};
    var idf = bind.replace(/\./g, '-');
    return '<div class="field"><label for="' + idf + '">' + label + (o.optional ? ' <span class="muted">(optional)</span>' : '') + '</label>' +
      (o.textarea ? '<textarea id="' + idf + '" data-bind="' + bind + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + dis() + '>' + esc(value) + '</textarea>'
        : '<input id="' + idf + '" type="' + (o.type || 'text') + '" data-bind="' + bind + '" value="' + esc(value) + '"' + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + (o.auto ? ' autocomplete="' + o.auto + '"' : '') + (o.step ? ' step="' + o.step + '"' : '') + dis() + ' />') +
      (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</div>';
  }
  // Post shape and actual outside size.
  function specEditor(base, spec, note) {
    spec = spec || {};
    var sizes = P.POST_SIZES[spec.shape] || [];
    var known = sizes.some(function (x) { return x[0] === Number(spec.size); });
    var custom = spec.custom || (spec.size && !known);
    return '<div class="spec-editor">' +
      '<div class="field"><span class="label">Shape</span>' + chips(base + '.shape', spec.shape, [['Round', 'Round'], ['Square', 'Square']]) + '</div>' +
      (spec.shape ? '<div class="field"><label for="' + base.replace(/\./g, '-') + '-sizesel">Outside size</label><select id="' + base.replace(/\./g, '-') + '-sizesel" data-size-select="' + base + '"' + dis() + '>' +
        '<option value="">Choose a size</option>' + sizes.map(function (x) { return '<option value="' + x[0] + '"' + (!custom && x[0] === Number(spec.size) ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') +
        '<option value="other"' + (custom ? ' selected' : '') + '>Another size</option></select>' +
        '<span class="hint">Measure the post itself with a tape or calipers. A “4x4” wood post is really 3 1/2 in.' + (note ? ' ' + note : '') + '</span></div>' +
        (custom ? textField(base + '.size', 'Size in inches', spec.size, { type: 'number', inputmode: 'decimal', step: '0.125' }) : '') : '') +
      '</div>';
  }
  var US_STATES = [['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']];
  function stateSelect(value) {
    var v = String(value || '').trim().toUpperCase();
    var hit = US_STATES.filter(function (x) { return x[0] === v || x[1].toUpperCase() === v; })[0];
    return '<div class="field"><label for="shipping-state">State</label><select id="shipping-state" data-bind="shipping.state" autocomplete="address-level1"' + dis() + '>' +
      '<option value="">Choose a state</option>' + US_STATES.map(function (x) { return '<option value="' + x[0] + '"' + (hit && hit[0] === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>';
  }
  function photoSlot(key, label, ph) {
    var fid = 'photo-' + key.replace(/\./g, '-');
    return '<li class="photo-slot' + (ph ? ' filled' : '') + '">' +
      (ph && ph.thumb ? '<img src="' + ph.thumb + '" alt="' + esc(label) + '" />' : '<div class="photo-ph" aria-hidden="true">' + (ph ? '✓' : '📷') + '</div>') +
      '<strong>' + esc(label) + '</strong>' + (ph ? '<span class="muted photo-name">' + esc(ph.name || ph) + '</span>' : '') +
      (editable() ? '<label class="btn btn-outline btn-small" for="' + fid + '">' + (ph ? 'Replace' : 'Add photo') + '</label><input class="sr-only" id="' + fid + '" type="file" accept="image/*" capture="environment" data-photo="' + key + '" />' +
        (ph ? '<button type="button" class="why-link" data-photo-del="' + key + '">Remove</button>' : '') : '') + '</li>';
  }
  function getPath(path) {
    var parts = path.split('.'), o = p;
    if (parts[0] === 'run') { o = p.runs[Number(parts[1])]; parts = parts.slice(2); }
    for (var k = 0; k < parts.length; k++) { if (o == null) return undefined; o = o[parts[k]]; }
    return o;
  }
  function setPath(path, v) {
    var parts = path.split('.'), o = p;
    if (parts[0] === 'run') { o = p.runs[Number(parts[1])]; parts = parts.slice(2); }
    for (var k = 0; k < parts.length - 1; k++) { if (o[parts[k]] == null) o[parts[k]] = {}; o = o[parts[k]]; }
    o[parts[parts.length - 1]] = v;
  }

  // ---------- Run drawing (B8): builds as measurements arrive ----------
  function runDrawing(r, i, small) {
    var n = r.posts.length, w = small ? 320 : 360, pad = 20, cy = small ? 16 : 40;
    var known = r.spans.map(function (x) { return x > 0 ? x : null; });
    var avg = known.filter(Boolean).reduce(function (a, b) { return a + b; }, 0) / (known.filter(Boolean).length || 1) || 1;
    var widths = known.map(function (x) { return x || avg; });
    var tot = widths.reduce(function (a, b) { return a + b; }, 0) || 1;
    var xs = [pad], acc = 0;
    widths.forEach(function (x) { acc += x; xs.push(pad + (w - 2 * pad) * acc / tot); });
    var segs = '', labels = '';
    for (var k = 0; k < n - 1; k++) {
      var unsure = !known[k] && r.unsure[k];
      segs += '<line x1="' + xs[k] + '" y1="' + cy + '" x2="' + xs[k + 1] + '" y2="' + cy + '" class="rd-span' + (known[k] ? ' set' : unsure ? ' unsure' : '') + '" />';
      if (!small) labels += '<text x="' + ((xs[k] + xs[k + 1]) / 2) + '" y="24" text-anchor="middle" class="rd-label' + (known[k] ? '' : ' empty') + '">' + (known[k] ? fmtQin(known[k]) : unsure ? 'not sure' : '?') + '</text>';
    }
    var posts = xs.map(function (x, k) {
      var end = k === 0 || k === n - 1, odd = !!r.posts[k].spec, kind = r.posts[k].kind;
      return '<circle cx="' + x + '" cy="' + cy + '" r="' + (end ? 8 : 6) + '" class="' + (end ? 'rd-end' : 'rd-mid') + (odd ? ' odd' : '') + '" />' +
        (end && kind && kind !== 'end' && !small ? '<text x="' + x + '" y="62" text-anchor="' + (k ? 'end' : 'start') + '" class="rd-kind">' + ({ corner: 'Corner', gate: 'Gate', wall: 'Wall' }[kind]) + '</text>' : '');
    }).join('');
    var measured = known.filter(Boolean).length;
    return '<svg class="run-drawing' + (small ? ' small' : '') + '" viewBox="0 0 ' + w + ' ' + (small ? 32 : 70) + '" role="img" aria-label="' + esc(r.name) + ': ' + n + ' posts, ' + measured + ' of ' + (n - 1) + ' measurements entered">' +
      segs + labels + posts +
      (small ? '' : '<text x="' + pad + '" y="62" class="rd-side" text-anchor="start" dy="' + (r.posts[0].kind && r.posts[0].kind !== 'end' ? 0 : 0) + '">' + (r.posts[0].kind && r.posts[0].kind !== 'end' ? '' : 'Left') + '</text><text x="' + (w - pad) + '" y="62" text-anchor="end" class="rd-side">' + (r.posts[n - 1].kind && r.posts[n - 1].kind !== 'end' ? '' : 'Right') + '</text>') +
      '</svg>';
  }
  function methodArt(m) {
    // Two posts with the dimension line between their faces (gap) or their centers (center).
    var a = m === 'gap' ? [52, 148] : [40, 160];
    return '<svg class="method-art" viewBox="0 0 200 70" aria-hidden="true"><rect x="28" y="10" width="24" height="50" rx="3" class="ma-post" /><rect x="148" y="10" width="24" height="50" rx="3" class="ma-post" />' +
      (m === 'center' ? '<line x1="40" y1="6" x2="40" y2="64" class="ma-center" /><line x1="160" y1="6" x2="160" y2="64" class="ma-center" />' : '') +
      '<line x1="' + a[0] + '" y1="36" x2="' + a[1] + '" y2="36" class="ma-dim" /><path d="M' + a[0] + ' 36l7 -5v10z M' + a[1] + ' 36l-7 -5v10z" class="ma-head" /></svg>';
  }
  function methodNote(compact) {
    var m = P.method(p);
    var txt = m === 'gap'
      ? '<strong>Measure the gap between posts.</strong> Your extensions are installed, so measure from the edge of one post to the edge of the next, at the height the topper will sit.'
      : '<strong>Measure center to center.</strong> Mark where each post will go, then measure from the center of one mark to the center of the next.';
    return '<div class="method-note' + (compact ? ' compact' : '') + '">' + methodArt(m) + '<p>' + txt + '</p></div>';
  }

  // ---------- Project overview: only what most projects share (Greg, 2026-10-23) ----------
  var STATUS = { installed: 'Installed', planned: 'Planned, not installed', undecided: 'Not decided yet', custom: 'My own design' };
  function questions() {
    var qs = [], base = P.BASES.filter(function (x) { return x.id === S.base; })[0];
    qs.push({ id: 'q-ext', title: 'Are your post extensions installed?', done: !!S.extStatus, summary: STATUS[S.extStatus] || '',
      help: 'The topper hangs on extension posts that rise above your fence. You or your contractor provide them.',
      body: function () {
        return options('setup.extStatus', S.extStatus, [
          ['installed', 'Yes, they’re installed', 'We’ll ask for the gap between posts.'],
          ['planned', 'Planned, not installed yet', 'We’ll ask where each post will go.'],
          ['undecided', 'Not decided yet', 'We can help you choose. You can keep going.'],
          ['custom', 'My own design', 'Describe it and send a drawing or photo.'],
        ], 'grid2');
      } });
    qs.push({ id: 'q-base', title: S.extStatus === 'installed' ? 'What are they mounted on?' : 'What will they mount on?', done: !!S.base, summary: base ? base.name : '',
      body: function () {
        return options('setup.base', S.base, P.BASES.map(function (x) { return [x.id, x.name, x.hint]; }), 'grid2') +
          ((S.base === 'square' || S.base === 'rail') ? '<div class="check-result review"><span class="cr-icon" aria-hidden="true">i</span><div><strong>We’ll plan this with you</strong><p>We haven’t finalized installation steps for ' + (S.base === 'rail' ? 'a top rail or wall' : 'square metal posts') + ' yet. Keep going, and we’ll work out the mounting during review.</p></div></div>' : '');
      } });
    if (S.extStatus) qs.push(extensionQuestion(base));
    qs.push({ id: 'q-style', title: 'Topper color and height', done: !!S.topperAnswered,
      summary: (COLOR_NAMES[p.color] || p.color) + ' · ' + (S.sameHeight === 'no' ? 'height set on each run' : p.height + ' in on every run'),
      body: function () {
        return '<div class="field"><span class="label">Fabric color</span>' + colorChips('color', p.color) + '</div>' +
          '<div class="field"><label for="p-height">' + 'Topper height' + '</label><select id="p-height" data-bind="height" data-num' + dis() + '>' +
          HEIGHTS.map(function (h) { return '<option value="' + h + '"' + (h === Number(p.height) ? ' selected' : '') + '>' + h + ' in</option>'; }).join('') + '</select><span class="hint">Color and height carry over from your estimate.</span></div>' +
          '<div class="field"><span class="label">Same height on every run?</span>' + options('setup.sameHeight', S.topperAnswered ? S.sameHeight : '', [['yes', 'Yes, one height', ''], ['no', 'No, it varies', 'You’ll set the height on each run.']], 'grid2') + '</div>';
      } });
    return qs;
  }
  function colorChips(bind, value) {
    return '<div class="chip-row colors" role="radiogroup">' + Object.keys(COLOR_NAMES).map(function (c) {
      var id = bind.replace(/\./g, '-') + '-' + c;
      return '<label class="chip-opt color-opt" for="' + id + '"><input id="' + id + '" type="radio" name="' + bind + '" value="' + c + '" data-bind="' + bind + '"' + (value === c ? ' checked' : '') + dis() + ' /><span><i class="dot" style="background:var(--swatch-' + c + ')"></i>' + esc(COLOR_NAMES[c]) + '</span></label>';
    }).join('') + '</div>';
  }
  function extCard(o, bind, value) {
    var f = P.EXT_FIT[o.id] || {};
    var id = bind.replace(/\./g, '-') + '-' + o.id;
    return '<label class="opt ext-opt" for="' + id + '"><input id="' + id + '" type="radio" name="' + bind + '" value="' + o.id + '" data-bind="' + bind + '"' + (value === o.id ? ' checked' : '') + dis() + ' />' +
      '<span><span class="ext-opt-head"><strong>' + esc(o.name) + '</strong>' + fitTag(o.id) + '</span><small>' + esc(o.fits) + ' · ' + esc(o.rise) + '</small>' +
      (value === o.id ? '<small class="fit-note">' + FIT[f.fit || 'review'][3] + '</small>' : '') + '</span></label>';
  }
  function extensionQuestion(base) {
    var rec = (base ? base.recommend : []).map(extById).filter(Boolean);
    var sizeDone = !!(S.post.shape && S.post.size);
    if (S.extStatus === 'undecided') {
      return { id: 'q-choose', title: 'Choosing an extension', done: !!(S.extender || S.helpExt || S.decideLater),
        summary: S.extender ? extById(S.extender).name : S.helpExt ? 'We’ll recommend one' : 'Deciding later',
        body: function () {
          return (rec.length ? '<p class="muted">These fit ' + esc(base.name.toLowerCase()) + '. Pick one now, or keep going and decide later.</p><div class="opt-list">' + rec.map(function (o) { return extCard(o, 'setup.extender', S.extender); }).join('') + '</div>'
            : '<p class="muted">' + (base ? 'We don’t have a recommended product for ' + esc(base.name.toLowerCase()) + ' yet.' : 'Tell us what they’ll mount on, and we’ll suggest options.') + ' We can help during review.</p>') +
            '<div class="q-actions"><button type="button" class="btn btn-outline" data-ext-help>Ask us to recommend one</button><button type="button" class="btn btn-outline" data-ext-later>Decide later</button></div>' +
            '<a class="link" href="' + FT.link('/fence-extenders') + '#options" target="_blank" rel="noopener">Compare every option</a>';
        } };
    }
    var o = extById(S.extender);
    var summary = (S.extStatus === 'custom' ? 'Your design' : o ? o.name : '') + (sizeDone ? (S.extStatus === 'custom' || o ? ' · ' : '') + P.sizeLabel(S.post) : '');
    return { id: 'q-choose', title: 'Extension shape and size', done: sizeDone && (S.extStatus !== 'custom' || !!S.customDesc), summary: summary,
      help: 'Measure the extension itself, where the topper will attach. Most projects use one size throughout. If a post is different, mark it on that run.',
      body: function () {
        var f = P.EXT_FIT[S.extender] || {};
        return (S.extStatus === 'custom'
          ? textField('setup.customDesc', 'Describe your design', S.customDesc, { textarea: true, placeholder: 'Material, how it attaches, and how far it rises' }) +
            '<div class="field"><span class="label">Who designed it? <span class="muted">(optional)</span></span>' + chips('setup.designer', S.designer, [['me', 'Me'], ['contractor', 'My contractor'], ['architect', 'My architect or designer']]) + '</div>' +
            '<label class="check" for="custom-installed"><input id="custom-installed" type="checkbox" data-bind="setup.customInstalled"' + (S.customInstalled ? ' checked' : '') + dis() + ' /> <span>It’s already installed</span></label>'
          : rec.length ? '<details class="more-opts"' + (S.extender ? ' open' : '') + '><summary>Using one of these? Tap it and we’ll fill in the size</summary><div class="opt-list">' + rec.map(function (x) { return extCard(x, 'setup.extender', S.extender); }).join('') + '</div></details>' : '') +
          specEditor('setup.post', S.post, f.size && o ? 'Filled in from the ' + esc(o.name) + ' listing.' : '') +
          (S.extStatus === 'custom' ? '<div class="field"><span class="label">Drawings or photos <span class="muted">(optional)</span></span><ul class="photo-grid">' + photoSlot('files.design1', 'Drawing or photo', p.files.design1) + photoSlot('files.design2', 'Another', p.files.design2) + '</ul></div>' +
            '<div class="check-result review"><span class="cr-icon" aria-hidden="true">i</span><div><strong>We’ll review your design</strong><p>We’ll check whether the topper can be adapted to it before we build. This isn’t an engineering approval.</p></div></div>' : '');
      } };
  }
  function overview() {
    var qs = questions(), allDone = qs.every(function (q) { return q.done; }), current = editingQ;
    if (!current) qs.forEach(function (q) { if (!current && !q.done) current = q.id; });
    if (allDone && !editingQ) {
      return '<section class="panel overview done" id="overview"><div class="sum-head"><h2>Project overview</h2></div><dl class="ov-list">' + qs.map(function (q) {
        return '<div class="ov-row" id="' + q.id + '"><dt>' + q.title + '</dt><dd>' + esc(q.summary) + '</dd>' + (editable() ? '<button type="button" class="why-link" data-q-edit="' + q.id + '" aria-label="Change: ' + esc(q.title) + '">Change</button>' : '') + '</div>';
      }).join('') + '</dl>' + (S.extender ? '<p class="ov-fit">' + fitTag(S.extender) + ' ' + FIT[(P.EXT_FIT[S.extender] || {}).fit][3] + '</p>' : '') + '</section>';
    }
    var html = '<section class="panel overview" id="overview"><h2>Project overview</h2><p class="muted">A few answers that apply to every run, so we don’t ask twice.</p><ol class="q-list">';
    qs.forEach(function (q, k) {
      if (q.id === current) {
        html += '<li class="q-card current" id="' + q.id + '"><span class="q-num" aria-hidden="true">' + (k + 1) + '</span><div class="q-body"><h3>' + q.title + '</h3>' + (q.help ? '<p class="muted">' + q.help + '</p>' : '') + q.body() +
          (q.done ? '<button type="button" class="btn btn-primary q-next" data-q-done>' + (allDone ? 'Done' : 'Next') + '</button>' : '') + '</div></li>';
      } else if (q.done) {
        html += '<li class="q-card answered" id="' + q.id + '"><span class="q-num done" aria-hidden="true">✓</span><div class="q-body"><span class="q-title">' + q.title + '</span><strong class="q-answer">' + esc(q.summary) + '</strong></div>' +
          (editable() ? '<button type="button" class="why-link" data-q-edit="' + q.id + '">Change</button>' : '') + '</li>';
      } else {
        html += '<li class="q-card upcoming" id="' + q.id + '"><span class="q-num" aria-hidden="true">' + (k + 1) + '</span><div class="q-body"><span class="q-title">' + q.title + '</span></div>' +
          (editable() ? '<button type="button" class="why-link" data-q-edit="' + q.id + '">Answer</button>' : '') + '</li>';
      }
    });
    return html + '</ol></section>';
  }

  // ---------- Project page: overview above the runs ----------
  function runSummary(r) {
    var len = P.runLength(p, r), n = r.posts.length;
    var measured = r.spans.filter(function (x) { return x > 0; }).length;
    return { len: len, measured: measured, total: n - 1, middles: n - 2 };
  }
  function projectStage() {
    var html = overview() + '<section class="runs-section"><div class="sum-head"><h2>Runs</h2><span class="muted">' + plural(p.runs.length, 'run') + '</span></div>' +
      '<p class="muted">A run is one straight section between two end posts. These came from your estimate.</p>' +
      (S.extStatus ? methodNote(true) : '') + '<ol class="run-list">';
    p.runs.forEach(function (r, i) {
      var s = runSummary(r), done = s.measured === s.total;
      html += '<li class="panel run-item' + (done ? ' done' : '') + '">' +
        '<div class="run-item-head"><div><h3>' + esc(r.name) + '</h3><p class="muted">' + (s.len ? fmtQin(s.len) + ' measured' : 'About ' + fmtQin(r.qin) + ' from your estimate') + ' · ' + plural(s.middles, 'middle post') +
        (S.sameHeight === 'no' ? ' · ' + P.runHeight(p, r) + ' in' : '') + '</p></div>' +
        '<span class="sec-status ' + (done ? 'ok' : 'warn') + '"><span aria-hidden="true">' + (done ? '✓' : '!') + '</span> ' + (done ? 'Measured' : s.measured + ' of ' + s.total + ' measured') + '</span></div>' +
        runDrawing(r, i, true) +
        (editable() ? '<div class="run-item-actions"><button type="button" class="btn btn-primary btn-small" data-open-run="' + i + '">' + (s.measured ? 'Edit' : 'Measure') + '</button>' +
          '<button type="button" class="why-link" data-dup="' + i + '">Duplicate</button>' +
          '<button type="button" class="icon-mini" data-move="' + i + '" data-dir="-1" aria-label="Move ' + esc(r.name) + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icon-mini" data-move="' + i + '" data-dir="1" aria-label="Move ' + esc(r.name) + ' down"' + (i === p.runs.length - 1 ? ' disabled' : '') + '>↓</button>' +
          (p.runs.length > 1 ? '<button type="button" class="why-link danger" data-del="' + i + '">' + (armedDelete === r.id ? 'Tap again to delete' : 'Delete') + '</button>' : '') + '</div>' : '') +
        '</li>';
    });
    html += '</ol>';
    if (editable()) {
      html += addingRun
        ? '<section class="panel add-run"><h3>Add a run</h3>' + mi('new-run', 0, 'About how long is it?') + '<p class="hint">A rough length is fine. It sets a starting number of posts.</p><div class="q-actions"><button type="button" class="btn btn-primary" data-add-run-go>Add run</button><button type="button" class="btn btn-outline" data-add-run-cancel>Cancel</button></div></section>'
        : '<button type="button" class="btn btn-outline btn-block add-run-btn" data-add-run>+ Add a run</button>';
    }
    return html + '</section><div class="stage-nav"><span></span><button type="button" class="btn btn-primary" data-stage="review">Review project</button></div>';
  }
  function postBlock(r, i, k) {
    var n = r.posts.length, end = k === 0 || k === n - 1, post = r.posts[k];
    var spec = P.postSpec(p, r, k), mustSpec = false;
    var key = r.id + '-' + k, showSpec = mustSpec || openPost[key] || !!post.spec;
    var base = 'run.' + i + '.posts.' + k;
    var specLine = S.extStatus === 'undecided' ? 'Size to come once you choose an extension'
      : spec && spec.shape && spec.size ? P.sizeLabel(spec) + (post.spec ? ' (different from your other posts)' : ' (same as your other posts)')
      : post.spec ? 'Describe this post' : 'Size from the project overview, not set yet';
    return '<li class="seq-post' + (end ? ' end' : '') + '" id="run-' + i + '-post-' + k + '"><span class="seq-dot" aria-hidden="true"></span><div class="seq-body">' +
      '<div class="seq-head"><h4>' + postName(r, k) + ' post</h4>' + (!end && editable() ? '<button type="button" class="why-link danger" data-rm-post="' + k + '">Remove</button>' : '') + '</div>' +
      (end ? '<div class="field"><span class="label">What’s at this end?</span>' + chips(base + '.kind', post.kind || 'end', KINDS) + (post.kind === 'corner' ? '<span class="hint">This post is shared with the next run. Measure each run from the center of a shared post.</span>' : '') + '</div>' : '') +
      '<p class="spec-line">' + esc(specLine) + '</p>' +
      (showSpec && S.extStatus !== 'undecided' ? specEditor(base + '.spec', post.spec || {}) + (post.spec && !mustSpec ? '<button type="button" class="why-link" data-same-post="' + k + '">Same as my other posts</button>' : '')
        : editable() && S.extStatus !== 'undecided' ? '<button type="button" class="why-link" data-odd-post="' + key + '">This post is different</button>' : '') +
      '</div></li>';
  }
  function spanBlock(r, i, k) {
    var m = P.method(p), unsure = !!r.unsure[k];
    var legend = (m === 'gap' ? 'Gap from ' : 'Center to center, ') + postName(r, k).toLowerCase() + ' to ' + postName(r, k + 1).toLowerCase();
    var needs = !(r.spans[k] > 0);
    return '<li class="seq-span' + (r.spans[k] > 0 ? ' set' : '') + (needs ? (unsure ? ' unsure' : ' needs') : '') + '" id="run-' + i + '-spanrow-' + k + '"><span class="seq-line" aria-hidden="true"></span><div class="seq-body">' +
      '<span class="label">' + (m === 'gap' ? 'Gap' : 'Center to center') + ': ' + postName(r, k) + ' → ' + postName(r, k + 1) + (needs ? ' <span class="needs-tag">' + (unsure ? 'Not sure yet' : 'Still needed') + '</span>' : '') + '</span>' +
      mi('run-' + i + '-span-' + k, r.spans[k] || 0, legend) +
      '<label class="check small" for="run-' + i + '-unsure-' + k + '"><input id="run-' + i + '-unsure-' + k + '" type="checkbox" data-unsure="' + k + '"' + (unsure ? ' checked' : '') + dis() + ' /> <span>Not sure yet</span></label>' +
      (editable() ? '<button type="button" class="add-post" data-add-post="' + (k + 1) + '"><span aria-hidden="true">+</span> Add a post here</button>' : '') +
      '</div></li>';
  }
  function runStage(i) {
    var r = p.runs[i], s = runSummary(r), m = P.method(p);
    var sum = r.spans.reduce(function (a, b) { return a + (b > 0 ? b : 0); }, 0);
    var seq = '';
    r.posts.forEach(function (_, k) { seq += postBlock(r, i, k); if (k < r.posts.length - 1) seq += spanBlock(r, i, k); });
    var ext = P.runExtender(p, r);
    var more = '<details class="panel run-more" id="run-' + i + '-more"' + (S.sameHeight === 'no' || r.extender || r.notes ? ' open' : '') + '><summary>More for this run</summary><div class="run-more-body">' +
      (S.sameHeight === 'no' ? '<div class="field"><label for="run-' + i + '-height">Topper height for this run</label><select id="run-' + i + '-height" data-bind="run.' + i + '.height" data-num' + dis() + '>' +
        HEIGHTS.map(function (h) { return '<option value="' + h + '"' + (h === P.runHeight(p, r) ? ' selected' : '') + '>' + h + ' in</option>'; }).join('') + '</select></div>' : '') +
      '<div class="field"><label for="run-' + i + '-ext">Fence extension on this run</label><select id="run-' + i + '-ext" data-bind="run.' + i + '.extender" data-nullable' + dis() + '>' +
        '<option value="">Same as the rest of the project' + (S.extender && extById(S.extender) ? ' (' + esc(extById(S.extender).name) + ')' : '') + '</option>' +
        EXT.map(function (o) { return '<option value="' + o.id + '"' + (r.extender === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') + '</select>' +
        (r.extender ? '<span class="hint">' + fitTag(r.extender) + ' ' + FIT[(P.EXT_FIT[r.extender] || {}).fit || 'review'][3] + '</span>' : '') + '</div>' +
      '<div class="field"><span class="label">Photos <span class="muted">(recommended)</span></span><p class="hint">Photos help us catch problems before we build.</p><ul class="photo-grid">' +
        P.photoSlots(r).map(function (sl) { return photoSlot('run.' + i + '.photos.' + sl.id, sl.name, r.photos[sl.id]); }).join('') + '</ul></div>' +
      textField('run.' + i + '.notes', 'Notes for us', r.notes, { textarea: true, optional: true, placeholder: 'A slope, a tree, an odd post, anything we should know' }) +
      '<button type="button" class="help-step" data-chat-open data-chat-prompt="' + esc(r.name + ': I need help measuring') + '"><span aria-hidden="true">💬</span> Get help with this run</button>' +
      '</div></details>';
    return '<div class="run-top"><button type="button" class="why-link" data-stage="project" data-to-runs>← All runs</button><span class="muted">Run ' + (i + 1) + ' of ' + p.runs.length + '</span></div>' +
      runSwitcher(i) + runChecklist(i) +
      '<section class="panel run-editor"><div class="field"><label for="run-' + i + '-name" class="sr-only">Run name</label><input id="run-' + i + '-name" class="run-name" data-bind="run.' + i + '.name" value="' + esc(r.name) + '"' + dis() + ' /></div>' +
      '<div class="drawing-wrap" data-drawing="' + i + '">' + runDrawing(r, i) + '</div>' +
      '<div class="run-totals" data-totals="' + i + '">' + totalsLine(r) + '</div>' +
      methodNote(true) +
      '<div class="mid-count"><span class="label">Middle posts</span><div class="stepper small-stepper"><button type="button" data-mid="-1" aria-label="Remove the last middle post"' + (r.posts.length <= 2 || !editable() ? ' disabled' : '') + '>−</button><output aria-live="polite">' + (r.posts.length - 2) + '</output><button type="button" data-mid="1" aria-label="Add a middle post"' + dis() + '>+</button></div></div>' +
      '<p class="hint">Start at the left end post as you face the fence from your side, and work right.</p>' +
      '<ol class="seq" id="run-' + i + '-seq">' + seq + '</ol></section>' + more +
      '<div class="stage-nav">' + (i > 0 ? '<button type="button" class="why-link" data-open-run="' + (i - 1) + '">← ' + esc(p.runs[i - 1].name) + '</button>' : '<button type="button" class="why-link" data-stage="project" data-to-runs>← All runs</button>') +
      (i < p.runs.length - 1 ? '<button type="button" class="btn btn-primary" data-open-run="' + (i + 1) + '">Next: ' + esc(p.runs[i + 1].name) + '</button>' : '<button type="button" class="btn btn-primary" data-stage="review">Review project</button>') + '</div>';
  }
  // Every run is one tap away, with what each still needs. Nothing here blocks moving on.
  function runOpen(r) {
    var n = r.spans.filter(function (x) { return !(x > 0); }).length;
    return n + r.posts.filter(function (x) { return x.spec && !(x.spec.shape && x.spec.size); }).length;
  }
  function runSwitcher(i) {
    if (p.runs.length < 2) return '';
    return '<nav class="run-switch" aria-label="Your runs"><ol>' + p.runs.map(function (r, k) {
      var n = runOpen(r);
      return '<li><button type="button" data-open-run="' + k + '"' + (k === i ? ' aria-current="page"' : '') + '><span class="rs-name">' + esc(r.name) + '</span>' +
        (n ? '<span class="rs-count" aria-label="' + n + ' still needed">' + n + '</span>' : '<span class="rs-done" aria-label="nothing needed">✓</span>') + '</button></li>';
    }).join('') + '</ol></nav>';
  }
  // "Checklist: Items still needed" for this run, each item a link to the field, plus a pointer to project questions.
  function runChecklist(i) {
    var r = p.runs[i], items = [];
    r.spans.forEach(function (x, k) {
      if (x > 0) return;
      var what = postName(r, k) + ' → ' + postName(r, k + 1);
      items.push({ label: r.unsure[k] ? 'Confirm ' + what + ' (marked not sure)' : 'Measure ' + what, field: 'run-' + i + '-spanrow-' + k });
    });
    r.posts.forEach(function (x, k) { if (x.spec && !(x.spec.shape && x.spec.size)) items.push({ label: 'Size of ' + postName(r, k).toLowerCase(), field: 'run-' + i + '-post-' + k }); });
    var setup = P.requirements(p).items.filter(function (x) { return x.where === 'setup' && x.level === 'needed'; });
    if (!editable()) return '';
    var li = function (x) { return '<li><button type="button" class="cl-link" data-goto="' + i + '" data-field="' + x.field + '">' + esc(x.label) + '</button></li>'; };
    return '<section class="panel run-checklist' + (items.length ? '' : ' clear') + '" id="run-checklist" aria-labelledby="rc-title">' +
      '<h3 id="rc-title">' + (items.length ? 'Checklist: Items still needed <span class="muted">(' + items.length + ')</span>' : '<span class="cl-icon ok" aria-hidden="true">✓</span> This run has everything we need') + '</h3>' +
      (items.length ? '<ul>' + items.map(li).join('') + '</ul>' : '') +
      (setup.length ? '<p class="hint">Also for your whole project: <button type="button" class="why-link" data-goto="setup" data-field="' + setup[0].field + '">' + plural(setup.length, 'question') + ' to answer</button></p>' : '') +
      (items.length ? '<p class="hint">You can switch runs anytime and come back. Nothing here stops you saving or moving on.</p>' : '') +
      '</section>';
  }
  function totalsLine(r) {
    var s = runSummary(r), sum = r.spans.reduce(function (a, b) { return a + (b > 0 ? b : 0); }, 0);
    if (!s.measured) return '<span class="muted">Your estimate used about ' + fmtQin(r.qin) + '.</span>';
    if (s.len) {
      // Overall = center to center plus half of each end post, so it matches a tape run outside edge to outside edge.
      var w = [0, r.posts.length - 1].map(function (k) { var sp = P.postSpec(p, r, k); return sp && sp.size ? Number(sp.size) * 4 : null; });
      var overall = w[0] != null && w[1] != null ? Math.round(s.len + (w[0] + w[1]) / 2) : null;
      return '<strong>' + fmtQin(s.len) + '</strong> center to center between the end posts' +
        (overall ? '<br><strong>' + fmtQin(overall) + '</strong> overall, outside edge to outside edge <span class="muted">(a quick tape check)</span>' : '') +
        (s.len !== r.qin ? '<br><span class="muted">Your estimate used ' + fmtQin(r.qin) + '. We’ll use your measurements.</span>' : '');
    }
    return 'Measured so far: <strong>' + fmtQin(sum) + '</strong> <span class="muted">· ' + (s.total - s.measured) + ' to go · estimate used ' + fmtQin(r.qin) + '</span>';
  }

  // ---------- Stage 3: Review ----------
  function openItems(req, compact) {
    var needed = req.items.filter(function (x) { return x.level === 'needed'; }), review = req.items.filter(function (x) { return x.level === 'review'; });
    var li = function (x) { return '<li><button type="button" class="cl-link" data-goto="' + x.where + '" data-field="' + x.field + '">' + esc(x.label) + '</button></li>'; };
    if (!req.items.length) return '<section class="panel open-items clear"><h3><span class="cl-icon ok" aria-hidden="true">✓</span> Nothing missing</h3><p class="muted">We have what we need to review your project.</p></section>';
    return '<section class="panel open-items">' +
      (needed.length ? '<div class="oi-group needed"><h3><span class="cl-icon" aria-hidden="true">!</span> Needed before we can build (' + needed.length + ')</h3><ul>' + needed.map(li).join('') + '</ul>' + (compact ? '' : '<p class="hint">You can still submit. We’ll work these out with you before production.</p>') + '</div>' : '') +
      (review.length ? '<div class="oi-group review"><h3><span class="cl-icon" aria-hidden="true">i</span> We’ll review with you (' + review.length + ')</h3><ul>' + review.map(li).join('') + '</ul></div>' : '') +
      '</section>';
  }
  function projectSummary() {
    var o = extById(S.extender);
    var extLine = S.extStatus === 'custom' ? 'Your own design' + (S.customDesc ? ': ' + S.customDesc : '') : o ? o.name : S.helpExt ? 'You asked us to recommend one' : 'Not chosen yet';
    var rows = [
      ['Extensions', ({ installed: 'Installed', planned: 'Chosen, not installed', undecided: 'Not decided', custom: 'Custom design' }[S.extStatus] || 'Not answered') + ' · ' + extLine],
      ['Mounted on', baseName(S.base) || 'Not answered'],
      ['Extension size', S.extStatus === 'undecided' ? 'Once you choose an extension' : P.sizeLabel(S.post) || 'Not answered'],
      ['Measured', P.method(p) === 'gap' ? 'Gap between installed posts' : 'Center to center, planned post locations'],
      ['Topper', (COLOR_NAMES[p.color] || p.color) + ', ' + (S.sameHeight === 'no' ? 'height set on each run' : p.height + ' in')],
    ];
    return '<section class="panel"><div class="sum-head"><h3>Project</h3>' + (editable() ? '<button type="button" class="why-link" data-stage="project">Edit</button>' : '') + '</div><dl class="sum-list">' +
      rows.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') +
      (S.extender ? '<dt>Fit</dt><dd>' + fitTag(S.extender) + '</dd>' : '') + '</dl></section>';
  }
  function runReview(r, i) {
    var s = runSummary(r), m = P.method(p), rows = '';
    r.posts.forEach(function (post, k) {
      var sp = P.postSpec(p, r, k), end = k === 0 || k === r.posts.length - 1;
      rows += '<tr><th scope="row">' + postName(r, k) + ' post</th><td>' + esc((sp && P.sizeLabel(sp)) || '—') + (post.spec ? ' <span class="tag-ok">Different</span>' : '') + (end && post.kind && post.kind !== 'end' ? ' · ' + esc(KINDS.filter(function (x) { return x[0] === post.kind; })[0][1]) : '') + '</td></tr>';
      if (k < r.posts.length - 1) rows += '<tr class="span-row"><th scope="row">' + (m === 'gap' ? 'Gap' : 'Center to center') + '</th><td>' + (r.spans[k] > 0 ? fmtQin(r.spans[k]) : r.unsure[k] ? '<span class="tag-error">Not sure</span>' : '<span class="tag-error">Missing</span>') + '</td></tr>';
    });
    var photos = Object.keys(r.photos).length;
    return '<section class="panel run-review"><div class="sum-head"><h3>' + esc(r.name) + '</h3>' + (editable() ? '<button type="button" class="why-link" data-open-run="' + i + '">Edit</button>' : '') + '</div>' +
      runDrawing(r, i) + '<p class="muted">' + (s.len ? fmtQin(s.len) + ' center to center' : 'Estimate ' + fmtQin(r.qin)) + ' · ' + plural(r.posts.length, 'post') + ' · ' + P.runHeight(p, r) + ' in ' + esc(COLOR_NAMES[P.runColor(p, r)] || '') +
      (r.extender ? ' · ' + esc(extById(r.extender).name) : '') + ' · ' + plural(photos, 'photo') + '</p>' +
      '<details class="post-table"><summary>Posts and measurements</summary><div class="table-wrap"><table><tbody>' + rows + '</tbody></table></div></details>' +
      (r.notes ? '<p><strong>Notes:</strong> ' + esc(r.notes) + '</p>' : '') + '</section>';
  }
  function reviewStage(req) {
    var s = p.shipping, ship = P.shippingDone(p);
    var html = '<section class="stage-intro"><span class="eyebrow">Step 3 of 3</span><h2>Review and submit</h2><p class="muted">Check everything once. We review every project before we build, then send you a final design and price to approve.</p></section>' +
      openItems(req) + projectSummary() + p.runs.map(runReview).join('');
    if (!editable()) return html;
    html += '<section class="panel" id="shipping"><h3>Shipping address</h3><div class="ship-grid">' +
      textField('shipping.name', 'Full name', s.name, { auto: 'name' }) + textField('shipping.street', 'Street address', s.street, { auto: 'street-address' }) +
      textField('shipping.city', 'City', s.city, { auto: 'address-level2' }) + stateSelect(s.state) +
      textField('shipping.zip', 'ZIP code', s.zip, { auto: 'postal-code', inputmode: 'numeric' }) + '</div></section>' +
      '<section class="panel submit-card" id="submit"><h3>Submit for review</h3>' +
      '<p>No payment now. You’ll approve your final design and price first, and pay after that.</p>' +
      (req.needed ? '<p class="muted">' + plural(req.needed, 'item') + ' above still ' + (req.needed === 1 ? 'needs an answer' : 'need answers') + '. We’ll contact you about them before we build.</p>' : '') +
      '<label class="check" for="review-ok"><input id="review-ok" type="checkbox" /> <span>These measurements and details are correct to the best of my knowledge.</span></label>' +
      '<p class="field-error" id="review-error" role="alert" hidden></p>' +
      '<button type="button" class="btn btn-primary btn-block" data-submit>Submit for review</button></section>';
    return html;
  }

  // ---------- Side panels ----------
  function estimatePanel() {
    var e = P.estimate(p), final = p.finalDesign && P.stateAtLeast(p, 'awaiting-approval');
    return '<section class="panel b-estimate" aria-labelledby="est-title"><h2 id="est-title">' + (final ? 'Final price' : 'Estimate') + '</h2><dl class="est-list">' +
      '<dt>Topper area <span class="muted">(' + (Math.round(e.sqft * 100) / 100) + ' sq ft × ' + FT.money(e.rates.perSqFt) + ')</span></dt><dd>' + FT.money(e.area) + '</dd>' +
      '<dt>Middle posts <span class="muted">(' + e.middle + ' × ' + FT.money(e.rates.perMiddlePost) + ')</span></dt><dd>' + FT.money(e.postCost) + '</dd>' +
      '<dt>Panels <span class="muted">(' + e.panels + ' × ' + FT.money(e.rates.perPanel) + ')</span></dt><dd>' + FT.money(e.build) + '</dd>' +
      '<dt>Shipping</dt><dd>' + (e.freeShipping ? 'Free' : 'With your design') + '</dd>' +
      '<dt class="total">' + (final ? 'Final price' : 'Estimated total') + '</dt><dd class="total">' + FT.money(final ? p.finalDesign.price : e.total) + '</dd></dl>' +
      '<p class="hint">' + (final ? 'Design version ' + p.finalDesign.version + '.' : 'Updates as you measure. Your final price comes with your design.') + ' Rates version ' + e.rateVersion + '.</p></section>';
  }
  function sideNeeded(req) {
    if (!editable()) return '';
    return '<section class="panel side-needed"><h2>Still needed</h2>' + (req.needed ? '<p><strong>' + plural(req.needed, 'item') + '</strong> before we can build' + (req.review ? ', and ' + req.review + ' we’ll review with you' : '') + '.</p>' : '<p>Nothing missing.</p>') +
      '<button type="button" class="why-link" data-stage="review">See the list</button></section>';
  }

  // ---------- Later tabs (after submit) ----------
  var TABS = [
    ['build', 'Build', function () { return true; }, ''],
    ['review', 'Questions', function () { return P.stateAtLeast(p, 'submitted'); }, 'Opens after you submit'],
    ['design', 'Final Design', function () { return !!p.finalDesign && P.stateAtLeast(p, 'awaiting-approval'); }, 'Opens when your design is ready'],
    ['approval', 'Approval', function () { return !!p.finalDesign && P.stateAtLeast(p, 'awaiting-approval'); }, 'Opens when your design is ready'],
    ['production', 'Production', function () { return P.stateAtLeast(p, 'deposit-due'); }, 'Opens after you approve'],
    ['messages', 'Messages', function () { return true; }, ''],
  ];
  function questionsTab() {
    var qs = p.questions.filter(function (q) { return !q.answered; });
    var html = '<section class="panel"><h2>Questions</h2>';
    if (!qs.length) html += '<p class="muted">We’re reviewing your project. We’ll message you if we need anything.</p>';
    qs.forEach(function (q) {
      var k = p.questions.indexOf(q);
      html += '<div class="question"><span class="eyebrow">Question from FenceTopper' + (q.run != null && p.runs[q.run] ? ' · ' + esc(p.runs[q.run].name) : '') + (q.field ? ' · ' + esc(q.field) : '') + '</span><p>' + esc(q.text) + '</p>' +
        '<div class="field"><label for="q-' + k + '">Your reply</label><textarea id="q-' + k + '" data-q="' + k + '"></textarea></div>' +
        '<button class="btn btn-primary" type="button" data-q-send="' + k + '">Send reply</button></div>';
    });
    return html + '</section>';
  }
  function designTab() {
    var d = p.finalDesign, e = P.estimate(p);
    return '<section class="panel"><span class="eyebrow">Design version ' + d.version + ' · ' + esc(d.date) + '</span><h2>Your final design</h2>' +
      p.runs.map(function (r, i) { return '<div class="design-run"><h3>' + esc(r.name) + '</h3>' + runDrawing(r, i) + '</div>'; }).join('') +
      '<h3>Price</h3><dl class="est-list price-compare"><dt>Your estimate</dt><dd>' + FT.money(e.total) + '</dd><dt>Final price</dt><dd>' + FT.money(d.price) + '</dd>' +
      '<dt>Difference</dt><dd>' + (d.price >= e.total ? '+' : '−') + FT.money(Math.abs(d.price - e.total)) + '</dd></dl>' +
      (d.note ? '<p class="muted">' + esc(d.note) + '</p>' : '') +
      '<p class="muted">A drawing with every dimension comes with the final design. <span class="placeholder">PDF coming</span></p>' +
      '<div class="ext-cta"><button class="btn btn-primary" type="button" data-tab-go="approval">Approve design</button><button class="btn btn-outline" type="button" data-tab-go="messages">Ask a question or request a change</button></div></section>';
  }
  function approvalTab() {
    var d = p.finalDesign;
    if (p.approval) return '<section class="panel"><h2>Approved</h2><p>Approved by ' + esc(p.approval.name) + ' on ' + P.when(p.approval.at) + ' (design version ' + p.approval.version + ').</p></section>';
    var dep = Math.round(d.price * 0.5 * 100) / 100;
    return '<section class="panel"><h2>Approve your design</h2><dl class="est-list"><dt>Design version</dt><dd>' + d.version + '</dd><dt>Final price</dt><dd>' + FT.money(d.price) + '</dd>' +
      '<dt>Deposit <span class="placeholder">50% placeholder</span></dt><dd>' + FT.money(dep) + '</dd></dl>' +
      '<p class="muted">Your topper is custom-built to this design.' + (S.extStatus !== 'installed' ? ' Install your extensions exactly where the design shows them.' : '') + '</p>' +
      '<label class="check" for="terms"><input id="terms" type="checkbox" /> <span>I approve this design and price, and I understand it’s built to order.</span></label>' +
      '<p class="field-error" id="terms-error" role="alert" hidden>Please check the box to approve.</p>' +
      '<div class="pay-card"><strong>Payment isn’t connected yet.</strong> <span class="placeholder">Placeholder</span> Approving in this preview records your approval and skips the payment step.</div>' +
      '<button class="btn btn-primary" type="button" data-approve>Approve and pay deposit</button></section>';
  }
  function productionTab() {
    var steps = [['scheduled', 'Approved and deposit paid'], ['in-production', 'In production'], ['quality', 'Quality review'], ['balance-due', 'Boxed, balance due'], ['ready-to-ship', 'Final payment'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];
    var order = Object.keys(P.STATES), cur = order.indexOf(p.state);
    return '<section class="panel"><h2>Production</h2><ol class="timeline">' + steps.map(function (s) {
      var k = order.indexOf(s[0]), cls = k < cur ? 'done' : k === cur ? 'current' : 'future';
      return '<li class="' + cls + '"><span class="tl-dot" aria-hidden="true">' + (cls === 'done' ? '✓' : '') + '</span>' + s[1] + (cls === 'current' ? ' <span class="muted">(now)</span>' : '') + '</li>';
    }).join('') + '</ol><p class="muted">Nothing needed from you while we build.</p></section>';
  }
  function messagesTab() {
    return '<section class="panel"><h2>Messages</h2><ul class="thread">' + (p.messages.length ? p.messages.map(function (m) {
      return '<li class="msg ' + (m.who === 'You' ? 'mine' : '') + '"><span class="msg-who">' + esc(m.who) + (m.run != null && p.runs[m.run] ? ' · ' + esc(p.runs[m.run].name) : '') + ' · ' + P.when(m.at) + '</span><p>' + esc(m.text) + '</p>' + (m.source ? '<span class="source-label">ⓘ ' + esc(m.source) + '</span>' : '') + '</li>';
    }).join('') : '<li class="muted">No messages yet. Ask us anything about your project.</li>') + '</ul>' +
      '<div class="field"><label for="msg-text">Message</label><textarea id="msg-text"></textarea></div>' +
      '<div class="msg-actions"><select id="msg-run" aria-label="About which run"><option value="">Whole project</option>' + p.runs.map(function (r, i) { return '<option value="' + i + '">' + esc(r.name) + '</option>'; }).join('') + '</select>' +
      '<button class="btn btn-primary" type="button" data-msg-send>Send</button></div></section>';
  }

  // ---------- Render ----------
  function stepper() {
    var st = [['project', 'Project and runs'], ['review', 'Review and submit']], cur = stage === 'run' ? 'project' : stage;
    return '<nav class="b-steps two" aria-label="Builder steps"><ol>' + st.map(function (x, k) {
      return '<li><button type="button" data-stage="' + x[0] + '"' + (cur === x[0] ? ' aria-current="step"' : '') + '><span class="b-step-num" aria-hidden="true">' + (k + 1) + '</span>' + x[1] + '</button></li>';
    }).join('') + '</ol></nav>';
  }
  function stickyBar(req) {
    if (tab !== 'build' || !editable()) return '';
    var btn = stage === 'project' ? '<button type="button" class="btn btn-primary" data-stage="review">Review project</button>'
      : stage === 'run' ? (runIdx < p.runs.length - 1 ? '<button type="button" class="btn btn-primary" data-open-run="' + (runIdx + 1) + '">Next run</button>' : '<button type="button" class="btn btn-primary" data-stage="review">Review project</button>')
      : '<button type="button" class="btn btn-primary" data-jump-submit>Submit for review</button>';
    // On a run, count what this run still needs (it matches the checklist above); elsewhere, the whole project.
    var n = stage === 'run' && p.runs[runIdx] ? runOpen(p.runs[runIdx]) : req.needed;
    var what = stage === 'run' ? ' on this run' : ' still needed';
    return '<div class="b-sticky">' + (n ? '<button type="button" class="why-link b-needed" data-show-needed>' + plural(n, 'item') + what + '</button>' : '<span>' + (stage === 'run' ? 'This run is complete' : 'Nothing missing') + '</span>') + btn + '</div>';
  }
  function render() {
    var active = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;
    var req = P.requirements(p);
    var t = TABS.filter(function (x) { return x[0] === tab; })[0];
    if (!t[2]()) tab = 'build';
    if (stage === 'run' && !p.runs[runIdx]) stage = 'project';
    var e = P.estimate(p), final = p.finalDesign && P.stateAtLeast(p, 'awaiting-approval');
    var main;
    if (tab === 'build') {
      main = (editable() ? '' : '<div class="note">Your project was submitted, so editing is locked. <button type="button" class="why-link" data-tab-go="messages">Message us</button> to change something.</div>') +
        (editable() ? stepper() : '') +
        (stage === 'project' ? projectStage() : stage === 'run' ? runStage(runIdx) : reviewStage(req));
    } else main = { review: questionsTab, design: designTab, approval: approvalTab, production: productionTab, messages: messagesTab }[tab]();
    rendering = true;
    root.innerHTML =
      '<header class="project-head">' +
        '<div class="ph-main"><label class="sr-only" for="p-name">Project name</label><input id="p-name" class="ph-name" data-bind="name" value="' + esc(p.name) + '"' + dis() + ' />' +
        P.badge(p.state) + '<span class="save-state" aria-live="polite" data-save-state>' + (savedAt ? 'Saved ' + savedAt : 'Saved') + '</span></div>' +
        '<div class="ph-total"><span class="muted">' + (final ? 'Final price' : 'Estimate') + '</span><strong data-ph-total>' + FT.money(final ? p.finalDesign.price : e.total) + '</strong></div>' +
        (editable() && !P.stateAtLeast(p, 'submitted') ? '' : '<nav class="ph-tabs" aria-label="Project sections">' + TABS.map(function (x) {
          var ok = x[2]();
          return '<button type="button" class="ph-tab" data-tab="' + x[0] + '"' + (x[0] === tab ? ' aria-current="page"' : '') + (ok ? '' : ' disabled title="' + x[3] + '"') + '>' + x[1] + '</button>';
        }).join('') + '</nav>') +
      '</header>' +
      '<div class="builder-grid"><div class="b-main">' + main + '</div>' +
        '<aside class="b-side">' + (tab === 'build' && stage !== 'review' ? sideNeeded(req) : '') + estimatePanel() +
        '<section class="panel b-help"><h2>Need a hand?</h2><p class="muted">Ask about any step, or send photos and we’ll help.</p><button class="btn btn-outline btn-block" type="button" data-chat-open data-chat-prompt="Help me with my project">Ask FenceTopper</button></section></aside>' +
      '</div>' + stickyBar(req);
    rendering = false;
    if (active) { var el = document.getElementById(active); if (el) el.focus({ preventScroll: true }); }
  }
  function go(s, i) {
    stage = s; if (i != null) runIdx = i;
    editingQ = null; armedDelete = null;
    history.replaceState(null, '', '#p=' + encodeURIComponent(p.id) + '&s=' + stage + (stage === 'run' ? '&r=' + runIdx : ''));
    render();
    window.scrollTo({ top: Math.max(0, root.offsetTop - 70), behavior: 'smooth' });
  }

  // ---------- Saving ----------
  function persist() {
    clearTimeout(saveTimer);
    var ss = root.querySelector('[data-save-state]'); if (ss) ss.textContent = 'Saving…';
    saveTimer = setTimeout(function () {
      P.save(p);
      savedAt = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      var s2 = root.querySelector('[data-save-state]'); if (s2) s2.textContent = 'Saved ' + savedAt;
    }, 400);
  }
  function rerender() { setTimeout(render, 0); }
  function refreshRunLive(i) {
    var r = p.runs[i], d = root.querySelector('[data-drawing="' + i + '"]'), t = root.querySelector('[data-totals="' + i + '"]');
    if (d) d.innerHTML = runDrawing(r, i);
    if (t) t.innerHTML = totalsLine(r);
    var tot = root.querySelector('[data-ph-total]'); if (tot) tot.textContent = FT.money(P.estimate(p).total);
  }

  // ---------- Events ----------
  root.addEventListener('input', function (ev) {
    var t = ev.target, fs = t.closest('[data-mi]');
    if (fs) {
      var m = fs.dataset.mi.match(/run-(\d+)-span-(\d+)/);
      if (m) { var r = p.runs[+m[1]], v = readMi(fs); r.spans[+m[2]] = v > 0 ? v : null; if (v > 0) r.unsure[+m[2]] = false; refreshRunLive(+m[1]); persist(); }
      return;
    }
    if (t.dataset.bind && t.type !== 'radio' && t.type !== 'checkbox' && t.tagName !== 'SELECT') {
      setPath(t.dataset.bind, t.value); persist();
      if (t.dataset.bind === 'name') return;
    }
  });
  // A measurement re-renders when focus leaves its feet, inches and fraction group, not between its fields.
  root.addEventListener('focusout', function (ev) {
    if (rendering) return;
    var fs = ev.target.closest && ev.target.closest('[data-mi]');
    if (fs && fs.dataset.mi.indexOf('run-') === 0 && !(ev.relatedTarget && fs.contains(ev.relatedTarget))) rerender();
  });
  root.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.closest('[data-mi]')) return;
    if (t.dataset.photo && t.files && t.files[0]) {
      var file = t.files[0], key = t.dataset.photo;
      thumb(file, function (src) { setPath(key, { name: file.name, thumb: src }); persist(); rerender(); });
      return;
    }
    if (t.dataset.sizeSelect) {
      var qc2 = t.closest('.q-card'); if (qc2) editingQ = qc2.id;
      var base = t.dataset.sizeSelect, spec = getPath(base) || {};
      if (t.value === 'other') { spec.custom = true; spec.size = ''; } else { spec.custom = false; spec.size = t.value ? Number(t.value) : ''; }
      setPath(base, spec);
    } else if (t.dataset.unsure != null) {
      var r = p.runs[runIdx]; r.unsure[+t.dataset.unsure] = t.checked;
    } else if (t.dataset.bind) {
      var b = t.dataset.bind, v = t.type === 'checkbox' ? t.checked : t.hasAttribute('data-num') ? Number(t.value) : t.hasAttribute('data-nullable') && !t.value ? null : t.value;
      if (/\.spec\.shape$/.test(b) || /^setup\.post\.shape$/.test(b)) setPath(b.replace(/shape$/, 'size'), ''); // new shape, new size list
      setPath(b, v);
      onAnswer(b, v);
      // Typing or picking from a list keeps that question open until Next; a tap on an option can move on.
      var qc = t.closest('.q-card'); if (qc && t.type !== 'radio') editingQ = qc.id;
    } else return; // unbound controls (terms, replies, messages) keep their own state
    if (t.dataset.bind === 'name') return;
    persist();
    if (stage === 'project' && t.type === 'radio' && t.closest('.q-card')) { // a choice that completes a question moves on to the next one
      var before = (root.querySelector('.q-card.current') || {}).id;
      render();
      var after = (root.querySelector('.q-card.current') || {}).id;
      if (after && after !== before) focusIn(after); else if (!after && before) { var rs = root.querySelector('.runs-section'); if (rs) rs.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    rerender();
  });
  // Side effects of setup answers: prefill what a listed product tells us, drop answers that no longer apply.
  function onAnswer(b, v) {
    if (b === 'setup.base' || b === 'setup.extStatus') { editingQ = null; }
    if (b === 'setup.extStatus') { S.helpExt = false; S.decideLater = false; if (v === 'custom') S.extender = ''; }
    if (b === 'setup.extender') {
      var f = P.EXT_FIT[v] || {};
      if (f.size) { S.post = { shape: f.shape, size: f.size }; }
      else if (f.shape && !S.post.shape) S.post = { shape: f.shape, size: '' };
      if (S.extStatus === 'undecided') { S.decideLater = false; S.helpExt = false; }
    }
    if (b === 'setup.sameHeight') S.topperAnswered = true;
  }
  root.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b || b.disabled) return;
    var d = b.dataset, r = p.runs[runIdx];
    if (d.tab) { tab = d.tab; render(); return; }
    if (d.tabGo) { tab = d.tabGo; render(); window.scrollTo({ top: Math.max(0, root.offsetTop - 70), behavior: 'smooth' }); return; }
    if (d.stage) { go(d.stage); if (b.hasAttribute('data-to-runs')) { var rs3 = root.querySelector('.runs-section'); if (rs3) setTimeout(function () { rs3.scrollIntoView({ block: 'start' }); }, 0); } return; }
    if (d.openRun != null) { go('run', +d.openRun); return; }
    if (b.hasAttribute('data-show-needed')) {
      if (stage === 'run' && document.getElementById('run-checklist')) focusIn('run-checklist');
      else { go('review'); setTimeout(function () { var oi = root.querySelector('.open-items'); if (oi) { oi.scrollIntoView({ behavior: 'smooth', block: 'start' }); flash(oi); } }, 60); }
      return;
    }
    if (d.qEdit) { editingQ = d.qEdit; render(); focusIn(d.qEdit); return; }
    if (b.hasAttribute('data-q-done')) {
      var cur = editingQ; editingQ = null; render();
      var next = root.querySelector('.q-card.current'); if (next) focusIn(next.id); else { var rs2 = root.querySelector('.runs-section'); if (rs2) rs2.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    if (b.hasAttribute('data-ext-help')) { S.helpExt = true; S.decideLater = false; S.extender = ''; p.messages.push({ who: 'You', text: 'Please recommend an extension' + (S.base ? ' for ' + baseName(S.base).toLowerCase() : '') + '.', at: new Date().toISOString() }); persist(); render(); FT.toast('We’ll recommend one when we review'); return; }
    if (b.hasAttribute('data-ext-later')) { S.decideLater = true; S.helpExt = false; S.extender = ''; persist(); render(); return; }
    if (b.hasAttribute('data-ext-custom')) { S.extStatus = 'custom'; S.extender = ''; editingQ = 'q-choose'; persist(); render(); focusIn('q-choose'); return; }
    if (d.dup != null) {
      var src = p.runs[+d.dup], copy = JSON.parse(JSON.stringify(src));
      copy.id = P.uid(); copy.name = src.name + ' copy'; copy.posts.forEach(function (x) { x.id = P.uid(); }); copy.photos = {};
      p.runs.splice(+d.dup + 1, 0, copy); persist(); render(); FT.toast('Duplicated ' + src.name); return;
    }
    if (d.move != null) {
      var i = +d.move, j = i + Number(d.dir), tmp = p.runs[i]; p.runs[i] = p.runs[j]; p.runs[j] = tmp; persist(); render();
      var mv = root.querySelector('[data-move="' + j + '"][data-dir="' + d.dir + '"]') || root.querySelector('[data-move="' + j + '"]'); if (mv) mv.focus();
      return;
    }
    if (d.del != null) {
      var dr = p.runs[+d.del];
      if (armedDelete !== dr.id) { armedDelete = dr.id; render(); var again = root.querySelector('[data-del="' + d.del + '"]'); if (again) again.focus(); return; }
      p.runs.splice(+d.del, 1); armedDelete = null; persist(); render(); FT.toast('Deleted ' + dr.name); return;
    }
    if (b.hasAttribute('data-add-run')) { addingRun = true; render(); var f = document.getElementById('new-run-ft'); if (f) f.focus(); return; }
    if (b.hasAttribute('data-add-run-cancel')) { addingRun = false; render(); return; }
    if (b.hasAttribute('data-add-run-go')) {
      var q = readMi(root.querySelector('[data-mi="new-run"]')) || 48 * 15;
      var nr = P.blankRun(q, 'Run ' + (p.runs.length + 1)); p.runs.push(nr); addingRun = false; persist(); go('run', p.runs.length - 1); return;
    }
    if (d.mid) {
      if (+d.mid > 0) { r.posts.splice(r.posts.length - 1, 0, { id: P.uid(), spec: null }); r.spans.push(null); }
      else if (r.posts.length > 2) { r.posts.splice(r.posts.length - 2, 1); r.spans.splice(r.spans.length - 1, 1); r.unsure.splice(r.spans.length, 1); }
      persist(); render(); return;
    }
    if (d.addPost) {
      var k = +d.addPost; // new post goes between post k-1 and post k; the span it splits needs measuring again
      r.posts.splice(k, 0, { id: P.uid(), spec: null }); r.spans.splice(k - 1, 1, null, null); r.unsure.splice(k - 1, 1, false, false);
      persist(); render(); focusIn('run-' + runIdx + '-post-' + k); return;
    }
    if (d.rmPost) {
      var k2 = +d.rmPost; // merging two spans: keep their sum when both are known
      var a = r.spans[k2 - 1], c = r.spans[k2], merged = a > 0 && c > 0 && P.method(p) === 'center' ? a + c : null;
      r.posts.splice(k2, 1); r.spans.splice(k2 - 1, 2, merged); r.unsure.splice(k2 - 1, 2, false);
      persist(); render(); return;
    }
    if (d.oddPost) { openPost[d.oddPost] = true; render(); return; }
    if (d.samePost) { r.posts[+d.samePost].spec = null; openPost[r.id + '-' + d.samePost] = false; persist(); render(); return; }
    if (d.goto != null) {
      if (d.goto === 'setup') { go('project'); editingQ = d.field; render(); focusIn(d.field); }
      else { go('run', +d.goto); focusIn(d.field); }
      return;
    }
    if (d.photoDel) { setPath(d.photoDel, undefined); var parts = d.photoDel.split('.'); var o = parts[0] === 'run' ? p.runs[+parts[1]][parts[2]] : p[parts[0]]; delete o[parts[parts.length - 1]]; persist(); render(); return; }
    if (b.hasAttribute('data-jump-submit')) { var sc = document.getElementById('submit'); if (sc) { sc.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('review-ok').focus({ preventScroll: true }); } return; }
    if (b.hasAttribute('data-submit')) { submit(); return; }
    if (d.qSend) {
      var qi = +d.qSend, ta = root.querySelector('[data-q="' + qi + '"]');
      if (!ta.value.trim()) { ta.focus(); return; }
      p.questions[qi].answered = true;
      p.messages.push({ who: 'You', text: ta.value.trim(), at: new Date().toISOString(), run: p.questions[qi].run });
      p.state = 'reply-received'; P.log(p, 'You', 'Answered a question'); P.save(p); render(); FT.toast('Reply sent'); return;
    }
    if (b.hasAttribute('data-msg-send')) {
      var txt = root.querySelector('#msg-text'), runSel = root.querySelector('#msg-run');
      if (!txt.value.trim()) { txt.focus(); return; }
      p.messages.push({ who: 'You', text: txt.value.trim(), at: new Date().toISOString(), run: runSel.value === '' ? null : +runSel.value });
      p.messages.push({ who: 'FenceTopper assistant', text: 'Thanks. A member of our build team will reply here. You’ll get an email when they do.', at: new Date().toISOString(), source: 'General explanation' });
      P.save(p); render(); return;
    }
    if (b.hasAttribute('data-approve')) {
      var box = root.querySelector('#terms');
      if (!box.checked) { root.querySelector('#terms-error').hidden = false; box.focus(); return; }
      var ct = FT.store.get('contact', {}) || {};
      p.approval = { name: ((ct.first || p.first || '') + ' ' + (ct.last || p.last || '')).trim() || 'Customer', at: new Date().toISOString(), version: p.finalDesign.version };
      p.state = 'scheduled'; P.log(p, 'You', 'Approved design version ' + p.finalDesign.version); P.save(p); tab = 'production'; render(); FT.toast('Design approved'); return;
    }
  });
  function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1600); }
  function focusIn(id) {
    setTimeout(function () {
      var el = document.getElementById(id); if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      flash(el);
      var f = el.querySelector('input:not([type=hidden]):not(.sr-only):not([disabled]), select, textarea, button');
      if (f) f.focus({ preventScroll: true });
    }, 30);
  }
  function submit() {
    var err = document.getElementById('review-error');
    if (!P.shippingDone(p)) { err.textContent = 'Add your shipping address so we can include shipping in your final price.'; err.hidden = false; focusIn('shipping'); return; }
    if (!document.getElementById('review-ok').checked) { err.textContent = 'Please confirm your measurements to submit.'; err.hidden = false; document.getElementById('review-ok').focus(); return; }
    var req = P.requirements(p);
    p.openAtSubmit = req.items.map(function (x) { return { level: x.level, label: x.label }; });
    p.state = 'submitted'; P.recordEstimate(p, 'Submitted'); P.log(p, 'You', 'Submitted for review' + (req.needed ? ' with ' + plural(req.needed, 'open item') : ''));
    P.save(p); tab = 'review'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); FT.toast('Submitted. We’ll review your project.');
  }
  function thumb(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var s = 240 / Math.max(img.width, img.height), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); cb(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = function () { cb(null); };
    img.src = url;
  }

  render();
})();
