/* ─────────────────────────────────────────────────────────────
   Veera Cloud — AI Agent Companion (mouse-follower widget)
   Drop-in, self-contained: injects its own CSS + markup + logic.
   Include on any page with:  <script src="/ai-agent-widget.js"></script>
   (adjust the src path depth as needed, e.g. "../ai-agent-widget.js")
   ───────────────────────────────────────────────────────────── */
(function () {
  var isTouch = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (isTouch) return; // no real cursor to trail on touch devices

  // ── Inject CSS (fixed, self-contained styling — deliberately NOT tied to the
  // host page's theme tokens, since 90+ pages use wildly different color
  // schemes and inheriting them caused low-contrast/unreadable bubbles) ──
  var style = document.createElement('style');
  style.id = 'ai-agent-styles';
  style.textContent = [
    '#ai-agent-trail { position: fixed; inset: 0; pointer-events: none; z-index: 499; }',
    '#ai-agent { position: fixed; top: 0; left: 0; width: 46px; height: 46px; pointer-events: none; z-index: 500; transform: translate(-50%,-50%); will-change: transform; }',
    '#ai-agent .agent-tilt { width: 100%; height: 100%; display: block; will-change: transform; }',
    '#ai-agent .agent-body { width: 100%; height: 100%; display: block; filter: drop-shadow(0 6px 14px rgba(0,113,227,0.4)); will-change: transform; }',
    '#ai-agent .agent-bob { will-change: transform; }',
    '#ai-agent .agent-eye { animation: agentBlink 3.6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }',
    '@keyframes agentBlink { 0%,90%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.12); } }',
    '#ai-agent .agent-pupil { transition: transform 0.03s linear; }',
    '#ai-agent .agent-antenna-dot { animation: agentPulseDot 1.2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }',
    '@keyframes agentPulseDot { 0%,100% { opacity: 0.55; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }',
    '#ai-agent-bubble { position: fixed; top: 0; left: 0; max-width: 230px; background: rgba(23,23,28,0.92); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); border: 0.5px solid rgba(255,255,255,0.14); border-radius: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.25), 0 16px 40px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(0,0,0,0.2); padding: 9px 12px 10px; pointer-events: none; z-index: 501; opacity: 0; transition: opacity 0.16s ease; }',
    '#ai-agent-bubble.agent-bubble-show { opacity: 1; }',
    '#ai-agent-bubble .agent-bubble-head { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #5ab2ff; margin-bottom: 3px; }',
    '#ai-agent-bubble .agent-bubble-text { font-size: 12px; font-weight: 500; line-height: 1.45; letter-spacing: -0.05px; color: #f2f2f5; min-height: 15px; }',
    '#ai-agent-bubble .agent-dots { display: inline-flex; align-items: center; gap: 4px; padding: 2px 0; }',
    '#ai-agent-bubble .agent-dots span { width: 5px; height: 5px; border-radius: 50%; background: #5ab2ff; opacity: 0.5; animation: agentDotsBounce 1.1s infinite; }',
    '#ai-agent-bubble .agent-dots span:nth-child(2) { animation-delay: .18s; }',
    '#ai-agent-bubble .agent-dots span:nth-child(3) { animation-delay: .36s; }',
    '@keyframes agentDotsBounce { 0%,100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-3px); opacity: 1; } }',
    '#ai-agent-bubble::after { content: \'\'; position: absolute; left: var(--arrow-left, 16px); bottom: -6px; width: 12px; height: 12px; background: rgba(23,23,28,0.92); border-right: 0.5px solid rgba(255,255,255,0.14); border-bottom: 0.5px solid rgba(255,255,255,0.14); transform: rotate(45deg); }',
    '#ai-agent-bubble.agent-bubble-below::after { bottom: auto; top: -6px; border-right: none; border-bottom: none; border-left: 0.5px solid rgba(255,255,255,0.14); border-top: 0.5px solid rgba(255,255,255,0.14); }'
  ].join('\n');
  document.head.appendChild(style);

  function init() {
    var AGENT_WORKER_URL = 'https://twilight-bread-fbaa.cloudgcp08.workers.dev/';
    var knowledgeCache = {};

    // Trail canvas (comet particles), sits just beneath the agent
    var trailCanvas = document.createElement('canvas');
    trailCanvas.id = 'ai-agent-trail';
    document.body.appendChild(trailCanvas);
    var tctx = trailCanvas.getContext('2d');
    function resizeTrail(){ trailCanvas.width = window.innerWidth; trailCanvas.height = window.innerHeight; }
    resizeTrail();
    window.addEventListener('resize', resizeTrail);

    var agent = document.createElement('div');
    agent.id = 'ai-agent';
    agent.innerHTML =
      '<div class="agent-tilt">' +
        '<svg class="agent-body agent-bob" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">' +
          '<defs>' +
            '<linearGradient id="agentGrad" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0%" stop-color="#5ab2ff"/>' +
              '<stop offset="100%" stop-color="#0071e3"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<line x1="23" y1="10" x2="23" y2="3" stroke="url(#agentGrad)" stroke-width="2" stroke-linecap="round"/>' +
          '<circle class="agent-antenna-dot" cx="23" cy="3" r="2.6" fill="#5ab2ff"/>' +
          '<rect x="7" y="10" width="32" height="26" rx="12" fill="url(#agentGrad)"/>' +
          '<rect x="12" y="16" width="22" height="14" rx="7" fill="rgba(255,255,255,0.92)"/>' +
          '<ellipse class="agent-eye" cx="18.5" cy="23" rx="2.6" ry="3.2" fill="rgba(255,255,255,0.98)" stroke="rgba(0,113,227,0.25)" stroke-width="0.5"/>' +
          '<ellipse class="agent-eye" cx="27.5" cy="23" rx="2.6" ry="3.2" fill="rgba(255,255,255,0.98)" stroke="rgba(0,113,227,0.25)" stroke-width="0.5"/>' +
          '<circle class="agent-pupil" id="agent-pupil-l" cx="18.5" cy="23" r="1.3" fill="#0071e3"/>' +
          '<circle class="agent-pupil" id="agent-pupil-r" cx="27.5" cy="23" r="1.3" fill="#0071e3"/>' +
        '</svg>' +
      '</div>';
    document.body.appendChild(agent);
    var tiltEl = agent.querySelector('.agent-tilt');
    var bobEl = agent.querySelector('.agent-bob');
    var pupilL = agent.querySelector('#agent-pupil-l');
    var pupilR = agent.querySelector('#agent-pupil-r');

    var bubble = document.createElement('div');
    bubble.id = 'ai-agent-bubble';
    bubble.innerHTML = '<div class="agent-bubble-text"></div>';
    document.body.appendChild(bubble);
    var bubbleText = bubble.querySelector('.agent-bubble-text');

    var mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    var agentX = mouseX, agentY = mouseY;
    var velX = 0, velY = 0;
    var trail = [];
    var reqToken = 0;
    var walkIntensity = 0;
    var bobPhase = 0;
    var lastTime = null;
    var pupilX = 0, pupilY = 0;

    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function showThinking(){
      bubbleText.innerHTML = '<span class="agent-dots"><span></span><span></span><span></span></span>';
    }

    var pageTitle = (document.title || 'this page').trim();

    function askAgent(label, fallback, cacheKey, myToken){
      var prompt = 'In one short, friendly sentence (max 18 words), explain what the "' + label +
        '" element does on a cloud/DevOps learning page titled "' + pageTitle +
        '" (part of Veera Cloud). No preamble, just the sentence.';
      fetch(AGENT_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 60,
          messages: [
            { role: 'system', content: 'You are a concise, friendly onboarding guide inside a cloud engineering learning site.' },
            { role: 'user', content: prompt }
          ]
        })
      })
      .then(function(r){ if(!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function(data){
        var text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
        if (!text) throw new Error('empty');
        knowledgeCache[cacheKey] = text;
        if (myToken === reqToken) bubbleText.textContent = text;
      })
      .catch(function(){
        knowledgeCache[cacheKey] = fallback;
        if (myToken === reqToken) bubbleText.textContent = fallback;
      });
    }

    // ── Auto-detect anything hoverable/meaningful, site-wide ──
    // Event delegation so it also catches elements added dynamically
    // later (quiz options, rendered cards, etc.), not just ones
    // present at page load.
    var HOVER_SELECTOR = [
      'a[href]', 'button', 'input', 'select', 'textarea', 'label',
      '[onclick]', '[role="button"]', '[role="tab"]', '[tabindex]',
      '.card', '.option', '.quiz-option', '.nav-item', '.btn'
    ].join(', ');

    function agentOwned(el){
      return !!el.closest('#ai-agent, #ai-agent-bubble, #ai-agent-trail');
    }

    function shortLabel(str, max){
      str = (str || '').trim().replace(/\s+/g, ' ');
      if (str.length > max) str = str.slice(0, max).trim() + '…';
      return str;
    }

    // Turns a raw href like "aws-1/veeraws1.html" or "https://youtube.com/..."
    // into a clean, spoken-friendly name — never shows file paths or .html.
    function friendlyDestination(href){
      if (!href) return 'another section';
      try {
        if (/^https?:\/\//i.test(href)) {
          var host = href.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '');
          return host || 'an external site';
        }
        var clean = href.split('#')[0].split('?')[0];
        var last = clean.split('/').filter(Boolean).pop() || '';
        last = last.replace(/\.(html?|php)$/i, '').replace(/[-_]+/g, ' ').trim();
        if (!last) return 'another section';
        last = last.replace(/\w\S*/g, function(t){ return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); });
        return last;
      } catch (e) {
        return 'another section';
      }
    }

    function humanizeClassName(el){
      var GENERIC = { active:1, selected:1, show:1, shown:1, hide:1, hidden:1, disabled:1,
        focus:1, hover:1, current:1, small:1, large:1, container:1, wrapper:1, item:1 };
      var classes = (el.className && el.className.baseVal !== undefined) ? [] :
        (el.className || '').split(/\s+/).filter(Boolean);
      for (var i = 0; i < classes.length; i++) {
        var c = classes[i].toLowerCase();
        if (GENERIC[c]) continue;
        var words = c.replace(/[-_]+/g, ' ').trim();
        if (words) {
          return words.replace(/\w\S*/g, function(t){ return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); });
        }
      }
      return '';
    }

    // Some elements only carry an id (no class, no text) — e.g. a lone
    // icon/avatar div. Use it too, but skip ids that look auto-generated
    // (long hashes/numbers) since those aren't meaningful words.
    function humanizeId(el){
      var id = el.id || '';
      if (!id || id.length > 24 || /\d{4,}/.test(id)) return '';
      var words = id.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
      if (!words) return '';
      return words.replace(/\w\S*/g, function(t){ return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); });
    }

    // Last resort: name it after its image file, e.g. "cat-mascot.png" -> "Cat Mascot".
    function labelFromImageSrc(el){
      var isImg = el.tagName && el.tagName.toLowerCase() === 'img';
      var img = isImg ? el : (el.querySelector && el.querySelector('img'));
      var src = img && img.getAttribute && img.getAttribute('src');
      if (!src) return '';
      try {
        var clean = src.split('#')[0].split('?')[0];
        var last = clean.split('/').filter(Boolean).pop() || '';
        last = last.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
        if (!last) return '';
        return last.replace(/\w\S*/g, function(t){ return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); });
      } catch (e) { return ''; }
    }

    function describeElement(el){
      var explicitTip = el.getAttribute('data-tip');
      var explicitLabel = el.getAttribute('data-label');
      var nestedImg = el.querySelector && el.querySelector('img[alt]');
      var nestedSvgTitle = el.querySelector && el.querySelector('svg title');
      var text = explicitLabel || el.getAttribute('aria-label') || el.getAttribute('title') ||
        el.getAttribute('placeholder') || el.getAttribute('alt') ||
        (el.textContent || '').trim() ||
        (nestedImg && nestedImg.getAttribute('alt')) ||
        (nestedSvgTitle && nestedSvgTitle.textContent) ||
        humanizeClassName(el) || humanizeId(el) || labelFromImageSrc(el) || '';
      var label = shortLabel(text, 60) || (el.tagName ? el.tagName.toLowerCase() : 'this');

      var fallback = explicitTip;
      if (!fallback) {
        var tag = el.tagName.toLowerCase();
        if (tag === 'a' && el.href) {
          fallback = 'Link — opens the ' + friendlyDestination(el.getAttribute('href')) + ' page.';
        } else if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          fallback = 'Input field — enter or choose "' + label + '" here.';
        } else if (el.classList.contains('option') || el.classList.contains('quiz-option')) {
          fallback = 'A selectable answer option for this question.';
        } else if (el.classList.contains('card')) {
          fallback = 'A clickable card — tap it to open that section.';
        } else if (label && label !== tag) {
          fallback = '"' + label + '" — click to use it.';
        } else {
          fallback = 'A ' + tag + ' element here — click to see what it does.';
        }
      }
      return { label: label, fallback: fallback };
    }

    var currentHoverEl = null;
    // fetch() to an external API from a file:// page is reliably blocked by
    // CORS in most browsers, so skip the network round-trip entirely here —
    // it would just fail after a delay and fall back anyway.
    var isFileProtocol = window.location.protocol === 'file:';

    document.addEventListener('mouseover', function(e){
      var el = e.target.closest(HOVER_SELECTOR);
      if (!el || agentOwned(el) || el === currentHoverEl) return;
      currentHoverEl = el;

      reqToken++;
      var myToken = reqToken;
      var info = describeElement(el);
      var cacheKey = pageTitle + '::' + info.label;

      bubble.classList.add('agent-bubble-show');
      if (knowledgeCache[cacheKey]) {
        bubbleText.textContent = knowledgeCache[cacheKey];
      } else if (isFileProtocol) {
        knowledgeCache[cacheKey] = info.fallback;
        bubbleText.textContent = info.fallback;
      } else {
        showThinking();
        askAgent(info.label, info.fallback, cacheKey, myToken);
      }
    });

    document.addEventListener('mouseout', function(e){
      var el = e.target.closest(HOVER_SELECTOR);
      if (!el || el !== currentHoverEl) return;
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      currentHoverEl = null;
      reqToken++;
      bubble.classList.remove('agent-bubble-show');
    });

    var EASE = 0.16;
    var LAG_X = -26;
    var LAG_Y = 22;
    var MOVE_ON = 0.55;
    var MOVE_OFF = 0.12;
    var WALK_BLEND = 0.045;
    var EDGE_MARGIN = 32;

    var BOB_FREQ_IDLE = (Math.PI * 2) / 2.4;
    var BOB_FREQ_WALK = (Math.PI * 2) / 0.4;
    var BOB_AMP_IDLE = 2;
    var BOB_AMP_WALK = 4;
    var BOB_ROT_WALK = 5;

    function tick(ts){
      var dt = lastTime ? Math.min(2, (ts - lastTime) / (1000 / 60)) : 1;
      lastTime = ts;

      var targetX = Math.min(window.innerWidth - EDGE_MARGIN, Math.max(EDGE_MARGIN, mouseX + LAG_X));
      var targetY = Math.min(window.innerHeight - EDGE_MARGIN, Math.max(EDGE_MARGIN, mouseY + LAG_Y));

      var prevX = agentX, prevY = agentY;
      var f = 1 - Math.pow(1 - EASE, dt);
      agentX += (targetX - agentX) * f;
      agentY += (targetY - agentY) * f;
      velX = agentX - prevX;
      velY = agentY - prevY;

      var speed = Math.sqrt(velX * velX + velY * velY) / Math.max(dt, 0.0001);

      var walkTarget = walkIntensity;
      if (speed > MOVE_ON) walkTarget = 1;
      else if (speed < MOVE_OFF) walkTarget = 0;
      walkIntensity += (walkTarget - walkIntensity) * Math.min(1, WALK_BLEND * dt);

      var bank = Math.max(-10, Math.min(10, velX * 1.6 * walkIntensity));
      var stretch = Math.min(0.1, speed * 0.008) * walkIntensity;
      tiltEl.style.transform = 'rotate(' + bank + 'deg) scale(' + (1 + stretch) + ',' + (1 - stretch * 0.6) + ')';

      var freq = BOB_FREQ_IDLE + (BOB_FREQ_WALK - BOB_FREQ_IDLE) * walkIntensity;
      bobPhase += freq * (dt / 60);
      var amp = BOB_AMP_IDLE + (BOB_AMP_WALK - BOB_AMP_IDLE) * walkIntensity;
      var bobY = -amp * (0.5 - 0.5 * Math.cos(bobPhase));
      var bobRot = -BOB_ROT_WALK * walkIntensity * (0.5 - 0.5 * Math.cos(bobPhase));
      bobEl.style.transform = 'translateY(' + bobY.toFixed(2) + 'px) rotate(' + bobRot.toFixed(2) + 'deg)';

      var dx = mouseX - agentX, dy = mouseY - agentY;
      var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      pupilX += ((dx / dist) * 1.1 - pupilX) * Math.min(1, 0.2 * dt);
      pupilY += ((dy / dist) * 1.1 - pupilY) * Math.min(1, 0.2 * dt);
      pupilL.setAttribute('transform', 'translate(' + pupilX.toFixed(2) + ',' + pupilY.toFixed(2) + ')');
      pupilR.setAttribute('transform', 'translate(' + pupilX.toFixed(2) + ',' + pupilY.toFixed(2) + ')');

      agent.style.transform = 'translate(' + agentX + 'px,' + agentY + 'px) translate(-50%,-50%)';

      if (bubble.classList.contains('agent-bubble-show')) {
        var VMARGIN = 10, GAP = 44, GAP_BELOW = 31, ARROW_PAD = 16;
        var bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        var placeBelow = (agentY - GAP - bh) < VMARGIN;
        var bTop = placeBelow ? (agentY + GAP_BELOW) : (agentY - GAP - bh);
        bTop = Math.max(VMARGIN, Math.min(window.innerHeight - bh - VMARGIN, bTop));
        var bLeft = agentX - bw / 2;
        bLeft = Math.max(VMARGIN, Math.min(window.innerWidth - bw - VMARGIN, bLeft));
        var arrowLeft = Math.max(ARROW_PAD, Math.min(bw - ARROW_PAD, agentX - bLeft));
        bubble.style.transform = 'translate(' + bLeft + 'px,' + bTop + 'px)';
        bubble.style.setProperty('--arrow-left', arrowLeft + 'px');
        bubble.classList.toggle('agent-bubble-below', placeBelow);
      }

      if (walkIntensity > 0.05) {
        trail.push({ x: agentX, y: agentY, life: walkIntensity });
        if (trail.length > 16) trail.shift();
      }
      tctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      for (var i = 0; i < trail.length; i++) {
        var p = trail[i];
        p.life -= 0.09 * dt;
        if (p.life <= 0) continue;
        tctx.beginPath();
        tctx.arc(p.x, p.y, 2.6 * p.life, 0, Math.PI * 2);
        tctx.fillStyle = 'rgba(0,113,227,' + (p.life * 0.3) + ')';
        tctx.fill();
      }
      trail = trail.filter(function(p){ return p.life > 0; });

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* ─────────────────────────────────────────────────────────────
   Veera Cloud — Site-wide Activity Tracker
   Logs every page the student opens and how long they stay, to
   veeraUsers/{uid}/appUsage/history on the login project.
   Also runs the single-device login guard (see guardSession below),
   which force-signs-out this device if the account gets logged in
   elsewhere.
   Self-contained: loads its own Firebase (compat) if not present.
   Included automatically on every page that loads this widget.
   ───────────────────────────────────────────────────────────── */
(function () {
  var LOGIN_CONFIG = {
    apiKey: "AIzaSyCFdcL1yRhonVFSMpLkZm2Cyqt2-NCHwBI",
    authDomain: "veera730pmonline.firebaseapp.com",
    projectId: "veera730pmonline",
    storageBucket: "veera730pmonline.firebasestorage.app",
    messagingSenderId: "570230262031",
    appId: "1:570230262031:web:63f3917d8197259bbcd67a"
  };

  // ── Friendly name + category for the current page ──
  function pageInfo() {
    var path = (location.pathname || '').toLowerCase();
    var file = path.split('/').pop() || 'index.html';
    var title = (document.title || '').split('·')[0].split('|')[0].split('—')[0].trim();

    var category = 'Other';
    if (path.indexOf('/aws-devops/') > -1 || file.indexOf('test-') === 0 || file.indexOf('-test') > -1 || path.indexOf('overall-test') > -1) category = 'Tests';
    else if (path.indexOf('/aws/') > -1 || file.indexOf('aws') > -1) category = 'AWS';
    else if (path.indexOf('/devops/') > -1) category = 'DevOps';
    else if (file.indexOf('git') > -1) category = 'Git';
    else if (file.indexOf('dashboard') > -1 || file.indexOf('demo') > -1) category = 'Dashboard';
    else if (file.indexOf('analytic') > -1) category = 'Analytics';
    else if (file.indexOf('dailytask') > -1 || file.indexOf('hand-on') > -1) category = 'Tasks';
    else if (file.indexOf('note') > -1 || file.indexOf('certif') > -1 || file.indexOf('policy') > -1) category = 'Notes';

    var name = title;
    if (!name || name.length < 2) {
      name = file.replace(/\.html?$/,'').replace(/[-_]/g,' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
    }
    return { name: name, category: category, path: path, file: file };
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (window.firebase && window.firebase.firestore) return window.firebase;
    if (!(window.firebase && window.firebase.apps)) {
      await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
    }
    await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');
    return window.firebase;
  }

  /* ── Single-device login guard ─────────────────────────────────────
     Kept fully separate from the usage-tracker's own app resolution
     below (which may land on a secondary app pointed at the shared
     veera730pmonline project). This piece always reads the DEFAULT
     Firebase app instead — i.e. whichever per-batch login project
     (veera730amoffline, veera900offline, etc.) the host page itself
     already initialized as default, exactly the app every page's own
     auth/session code runs under.

     login.html mints a fresh session id on every successful login and
     stamps it onto veeraUsers/{uid}.activeSessionId in Firestore. This
     listens to that same doc live and force-signs this device out the
     moment it sees a session id that isn't its own — i.e. the account
     was just logged in somewhere else. Pages can override the redirect
     target by setting window.VEERA_LOGIN_PATH before this script loads;
     it defaults to 'login.html'. ───────────────────────────────────── */
  function waitForDefaultApp(fb, timeoutMs) {
    return new Promise(function (resolve) {
      var started = Date.now();
      (function poll() {
        var def = fb.apps && fb.apps.filter(function (a) { return a.name === '[DEFAULT]'; })[0];
        if (def) return resolve(def);
        if (Date.now() - started > timeoutMs) return resolve(null);
        setTimeout(poll, 200);
      })();
    });
  }

  async function guardSession(fb) {
    var defaultApp = await waitForDefaultApp(fb, 8000);
    if (!defaultApp) return; // no per-batch login app on this page — nothing to guard

    var auth = fb.auth(defaultApp);
    var db = fb.firestore(defaultApp);
    var unsub = null;

    auth.onAuthStateChanged(function (user) {
      if (unsub) { unsub(); unsub = null; }
      if (!user) return;

      var mySessionId = localStorage.getItem('veeraSessionId');
      // No local session id means this tab never went through the
      // session-stamping login flow — don't guess, just skip enforcement.
      if (!mySessionId) return;

      unsub = db.collection('veeraUsers').doc(user.uid).onSnapshot(function (snap) {
        var data = snap.data();
        if (!data || !data.activeSessionId) return;         // nothing stamped yet
        if (data.activeSessionId === mySessionId) return;    // still the active device

        if (unsub) { unsub(); unsub = null; }
        var label = data.activeDeviceLabel || 'another device';
        auth.signOut().catch(function () {}).finally(function () {
          localStorage.removeItem('veeraSessionId');
          alert('You were signed out because your account was logged in on ' + label + '.');
          window.location.href = window.VEERA_LOGIN_PATH || 'login.html';
        });
      }, function (err) {
        console.warn('sessionGuard listener error (non-fatal):', err);
      });
    });
  }

  async function start() {
    var fb;
    try { fb = await ensureFirebase(); } catch (e) { return; }
    if (!fb) return;

    guardSession(fb); // fire-and-forget — must never block/delay usage tracking below

    var app;
    try {
      app = fb.apps && fb.apps.length
        ? (fb.apps.find(function(a){ return a.options && a.options.projectId === 'veera730pmonline'; }) || fb.initializeApp(LOGIN_CONFIG, 'usagetracker'))
        : fb.initializeApp(LOGIN_CONFIG);
    } catch (e) {
      try { app = fb.initializeApp(LOGIN_CONFIG, 'usagetracker2'); } catch (e2) { return; }
    }

    var auth = fb.auth(app);
    var db = fb.firestore(app);

    auth.onAuthStateChanged(function (user) {
      if (!user) return;          // only track signed-in students
      saveName(db, user);
      track(db, user);
    });
  }

  // Stamps the student's display name onto their veeraUsers doc so "Who's
  // online" (analytics.html) can show a real name instead of a placeholder
  // for anyone active anywhere on the site — not just people who've opened
  // Analytics themselves, which used to be the only page doing this write.
  function saveName(db, user) {
    var displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    if (!displayName) return;
    db.collection('veeraUsers').doc(user.uid).set({ name: displayName }, { merge: true })
      .catch(function (err) { console.warn('saveName failed (non-fatal):', err); });
  }

  function track(db, user) {
    var ref = db.collection('veeraUsers').doc(user.uid).collection('appUsage').doc('history');
    var info = pageInfo();
    var enter = Date.now();
    var saved = false;

    // Log this visit's start immediately (so "currently viewing" is live),
    // then patch the duration on leave.
    var visitId = enter + '_' + Math.random().toString(36).slice(2, 7);

    function commit(seconds, isFinal) {
      if (saved && isFinal) return;
      var entry = {
        id: visitId,
        name: info.name,
        category: info.category,
        path: info.path,
        at: enter,
        seconds: Math.max(0, Math.round(seconds))
      };
      // Read-modify-write the rolling log + totals + per-category tally.
      return db.runTransaction(function (tx) {
        return tx.get(ref).then(function (snap) {
          var d = snap.exists ? (snap.data() || {}) : {};
          var log = Array.isArray(d.log) ? d.log : [];
          var totalSeconds = d.totalSeconds || 0;
          var visits = d.visits || 0;
          var byCategory = d.byCategory || {};
          var pages = d.pages || {};

          // find existing entry for this visit (update) or append (new)
          var idx = -1;
          for (var i = log.length - 1; i >= 0; i--) { if (log[i] && log[i].id === visitId) { idx = i; break; } }
          var prevSecs = idx > -1 ? (log[idx].seconds || 0) : 0;
          var delta = entry.seconds - prevSecs;

          if (idx > -1) log[idx] = entry; else { log.push(entry); visits += 1; }
          if (log.length > 100) log = log.slice(-100);

          totalSeconds = Math.max(0, totalSeconds + delta);
          byCategory[info.category] = Math.max(0, (byCategory[info.category] || 0) + delta);
          pages[info.name] = Math.max(0, (pages[info.name] || 0) + delta);

          tx.set(ref, {
            log: log,
            totalSeconds: totalSeconds,
            visits: visits,
            byCategory: byCategory,
            pages: pages,
            lastPage: info.name,
            lastCategory: info.category,
            updatedAt: Date.now()
          }, { merge: true });
        });
      }).catch(function(){ /* best-effort */ });
    }

    // initial write (0s) so the visit registers even on very short views
    commit(0, false);

    // periodic heartbeat every 15s to persist time on long views
    var hb = setInterval(function () {
      if (document.hidden) return;
      commit((Date.now() - enter) / 1000, false);
    }, 15000);

    function finalize() {
      clearInterval(hb);
      commit((Date.now() - enter) / 1000, true);
      saved = true;
    }

    window.addEventListener('pagehide', finalize);
    window.addEventListener('beforeunload', finalize);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) commit((Date.now() - enter) / 1000, false);
    });
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();


/* ─────────────────────────────────────────────────────────────
   Veera Cloud — Live Presence
   Explicit "who's on the site right now" tracking, separate from the
   usage-history tracker above. Writes into the SAME shared task-tracker
   project every batch's analytics.html already reads (submissions,
   points, batches, etc.), instead of the per-batch login project, so
   presence is consistent across all batches rather than depending on
   each batch's own auth project matching up.

   On arrival: adds liveUsers/{uid}. A heartbeat keeps it fresh while the
   tab is open. On a clean close/navigate-away: deletes it. Anything not
   refreshed in ~50s is treated as offline by the reader (analytics.html),
   as a safety net for crashes/force-closes that never fire a close event.
   ───────────────────────────────────────────────────────────── */
(function () {
  var TASK_TRACKER_CONFIG = {
    apiKey: "AIzaSyAE3mBpbQ0be_I7baVrVMT0ppTfvEPB38I",
    authDomain: "student-task-tracker-c892a.firebaseapp.com",
    projectId: "student-task-tracker-c892a",
    storageBucket: "student-task-tracker-c892a.firebasestorage.app",
    messagingSenderId: "270942651958",
    appId: "1:270942651958:web:5114d65ea5bcbf613d7a97"
  };
  var HEARTBEAT_MS = 20000;

  function waitForDefaultApp(fb, timeoutMs) {
    return new Promise(function (resolve) {
      var started = Date.now();
      (function poll() {
        var def = fb.apps && fb.apps.filter(function (a) { return a.name === '[DEFAULT]'; })[0];
        if (def) return resolve(def);
        if (Date.now() - started > timeoutMs) return resolve(null);
        setTimeout(poll, 200);
      })();
    });
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (window.firebase && window.firebase.firestore) return window.firebase;
    if (!(window.firebase && window.firebase.apps)) {
      await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
    }
    await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');
    return window.firebase;
  }

  function goLive(taskDb, user) {
    var displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Student');
    var ref = taskDb.collection('liveUsers').doc(user.uid);

    function beat() {
      ref.set({ uid: user.uid, name: displayName, page: pageLabel(), lastActive: Date.now() }, { merge: true })
        .catch(function () { /* best-effort */ });
    }
    function pageLabel() {
      return (document.title || '').split('·')[0].split('|')[0].split('—')[0].trim() || location.pathname;
    }
    function goOffline() {
      clearInterval(hb);
      ref.delete().catch(function () { /* best-effort */ });
    }

    beat();
    var hb = setInterval(function () { if (!document.hidden) beat(); }, HEARTBEAT_MS);
    window.addEventListener('pagehide', goOffline);
    window.addEventListener('beforeunload', goOffline);
  }

  async function start() {
    var fb;
    try { fb = await ensureFirebase(); } catch (e) { return; }
    if (!fb) return;

    var defaultApp = await waitForDefaultApp(fb, 8000);
    if (!defaultApp) return; // no per-batch login app on this page — nothing to report presence for

    var auth = fb.auth(defaultApp);

    var taskApp;
    try {
      taskApp = (fb.apps || []).filter(function (a) { return a.options && a.options.projectId === 'student-task-tracker-c892a'; })[0]
        || fb.initializeApp(TASK_TRACKER_CONFIG, 'livepresence');
    } catch (e) {
      try { taskApp = fb.initializeApp(TASK_TRACKER_CONFIG, 'livepresence2'); } catch (e2) { return; }
    }
    var taskDb = fb.firestore(taskApp);

    auth.onAuthStateChanged(function (user) {
      if (!user) return;
      goLive(taskDb, user);
    });
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
