// ---------- state ----------
let state = { friends: [], settings: {} };
const photoCache = {}; // filename -> dataURL

const PALETTE = [
  { key: 'pink',   bg: '#ED93B1', text: '#4B1528', pin: '#D4537E' },
  { key: 'coral',  bg: '#F0997B', text: '#4A1B0C', pin: '#D85A30' },
  { key: 'amber',  bg: '#EF9F27', text: '#412402', pin: '#BA7517' },
  { key: 'green',  bg: '#97C459', text: '#173404', pin: '#639922' },
  { key: 'teal',   bg: '#5DCAA5', text: '#04342C', pin: '#1D9E75' },
  { key: 'blue',   bg: '#85B7EB', text: '#042C53', pin: '#378ADD' },
  { key: 'purple', bg: '#AFA9EC', text: '#26215C', pin: '#7F77DD' },
  { key: 'gray',   bg: '#B4B2A9', text: '#2C2C2A', pin: '#888780' }
];
const colorOf = (key) => PALETTE.find(p => p.key === key) || PALETTE[0];

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function daysSince(iso) {
  if (!iso) return 0;
  const diff = startOfDay(new Date()) - startOfDay(new Date(iso));
  return Math.max(0, Math.round(diff / 86400000));
}

// most recent of texted / called (falls back to legacy lastContact)
function lastTalkedIso(f) {
  const times = [f.lastTexted, f.lastCalled, f.lastContact].filter(Boolean).map(d => new Date(d).getTime());
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}
function daysSinceOrNull(iso) { return iso ? daysSince(iso) : null; }
// turn a yyyy-mm-dd date input value into a stored timestamp (noon, to dodge timezone slips)
function dateInputToIso(v) { return v ? new Date(v + 'T12:00:00').toISOString() : null; }
function isoToDateInput(iso) { if (!iso) return ''; const d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function dayLabel(days) {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return days + ' days';
}

function fadeStyle(days) {
  const max = state.settings.fadeMaxDays || 90;
  let t;
  if (state.settings.fadeMode === 'stepped') {
    if (days < 14) t = 0;
    else if (days < max) t = 0.5;
    else t = 1;
  } else {
    t = Math.min(1, Math.max(0, days / max));
  }
  const sepia = (t * 0.95).toFixed(2);
  const sat = (1 - t * 0.6).toFixed(2);
  const opacity = (1 - t * 0.42).toFixed(2);
  return { filter: `sepia(${sepia}) saturate(${sat})`, opacity };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtBirthday(mmdd) {
  if (!mmdd) return null;
  const [m, d] = mmdd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
function nextBirthday(mmdd) {
  if (!mmdd) return null;
  const [m, d] = mmdd.split('-').map(Number);
  const today = startOfDay(new Date());
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return next;
}
function daysUntil(date) {
  return Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
}
function bdayCountdown(days) {
  if (days === 0) return 'today!';
  if (days === 1) return 'tomorrow';
  return 'in ' + days + ' days';
}

function planInfo(f) {
  if (!f.plan || !f.plan.date) return null;
  const date = new Date(f.plan.date);
  return { date, days: daysUntil(date), label: (f.plan.label || 'plans') };
}

async function save() { await window.api.saveData(state); }

async function getPhoto(filename) {
  if (!filename) return null;
  if (photoCache[filename] !== undefined) return photoCache[filename];
  const url = await window.api.readPhoto(filename);
  photoCache[filename] = url;
  return url;
}

// ---------- board rendering ----------
const board = $('#board');
const threadsSvg = $('#threads');

function mostOverdueId() {
  const nudgeAfter = state.settings.nudgeAfterDays || 30;
  let best = null, bestDays = -1;
  for (const f of state.friends) {
    const d = daysSince(lastTalkedIso(f));
    if (d > nudgeAfter && d > bestDays) { best = f.id; bestDays = d; }
  }
  return best;
}

function renderBoard() {
  // remove existing polaroids and rings, keep the svg
  [...board.querySelectorAll('.polaroid, .nudge-ring')].forEach(el => el.remove());

  const leadDays = state.settings.birthdayLeadDays || 14;
  const nudgeId = mostOverdueId();

  for (const f of state.friends) {
    const el = document.createElement('div');
    el.className = 'polaroid';
    el.dataset.id = f.id;
    el.style.left = (f.x || 200) + 'px';
    el.style.top = (f.y || 160) + 'px';
    el.style.width = (f.w || 190) + 'px';
    el.style.height = (f.h || 230) + 'px';
    el.style.transform = `rotate(${f.rot || 0}deg)`;

    const c = colorOf(f.color);
    const days = daysSince(lastTalkedIso(f));
    const fade = fadeStyle(days);

    // pin or tape
    if (f.style === 'tape') {
      const t = document.createElement('div');
      t.className = 'tape';
      el.appendChild(t);
    } else {
      const p = document.createElement('div');
      p.className = 'pin';
      p.style.background = c.pin;
      el.appendChild(p);
    }

    // birthday flag
    const nb = nextBirthday(f.birthday);
    if (nb && daysUntil(nb) <= leadDays) {
      const flag = document.createElement('div');
      flag.className = 'flag';
      flag.textContent = '🎂 ' + daysUntil(nb) + 'd';
      el.appendChild(flag);
    }

    // plan flag
    const pi = planInfo(f);
    const planLead = state.settings.planLeadDays || 3;
    if (pi && pi.days >= 0 && pi.days <= planLead) {
      const pflag = document.createElement('div');
      pflag.className = 'flag-plan';
      pflag.textContent = '📅 ' + (pi.days === 0 ? 'today' : pi.days + 'd');
      el.appendChild(pflag);
    }

    // flip card: photo on the front, handwritten details on the back
    const flip = document.createElement('div');
    flip.className = 'flip';
    const front = document.createElement('div');
    front.className = 'face front';
    front.style.filter = fade.filter;
    front.style.opacity = fade.opacity;
    const back = document.createElement('div');
    back.className = 'face back';

    // front: photo + caption
    const initial = (f.name || '?').trim().charAt(0).toUpperCase();
    const fb = document.createElement('div');
    fb.className = 'photo-fallback';
    fb.style.background = c.bg;
    fb.style.color = c.text;
    fb.textContent = initial;
    front.appendChild(fb);
    if (f.photo) {
      getPhoto(f.photo).then(url => {
        if (!url) return;
        const img = document.createElement('img');
        img.className = 'photo';
        img.src = url;
        img.alt = f.name;
        fb.replaceWith(img);
      });
    }
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.innerHTML = `<span class="nm"></span><span class="dy"></span>`;
    cap.querySelector('.nm').textContent = f.name || 'Someone';
    cap.querySelector('.dy').textContent = dayLabel(days);
    front.appendChild(cap);

    // back: the details, like writing on the back of a photo
    const rows = [`<div class="b-name">${escapeHtml(f.name || 'Someone')}</div>`,
      `<div class="b-row">last talked ${dayLabel(days)}</div>`];
    const dt = daysSinceOrNull(f.lastTexted);
    const dcl = daysSinceOrNull(f.lastCalled);
    if (dt !== null) rows.push(`<div class="b-row">💬 texted ${dayLabel(dt)}</div>`);
    if (dcl !== null) rows.push(`<div class="b-row">📞 called ${dayLabel(dcl)}</div>`);
    if (nb) rows.push(`<div class="b-row">🎂 ${fmtBirthday(f.birthday)} · ${bdayCountdown(daysUntil(nb))}</div>`);
    if (pi && pi.days >= 0) rows.push(`<div class="b-row">📅 ${escapeHtml(pi.label)} · ${bdayCountdown(pi.days)}</div>`);
    if (f.note) rows.push(`<div class="b-note">“${escapeHtml(f.note)}”</div>`);
    back.innerHTML = `<div class="b-scroll">${rows.join('')}</div><div class="b-hint">click to open</div>`;

    flip.appendChild(front);
    flip.appendChild(back);
    el.appendChild(flip);

    const grip = document.createElement('div');
    grip.className = 'resize-handle';
    grip.title = 'drag to resize';
    el.appendChild(grip);
    enableResize(grip, el, f);

    enableDrag(el, f);
    board.appendChild(el);

    if (f.id === nudgeId) addNudgeRing(el);
  }

  renderThreads();
  updateEmptyStates();
}

function enableResize(grip, el, f) {
  grip.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // don't start a move-drag
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = f.w || 190, startH = f.h || 230;
    grip.setPointerCapture(e.pointerId);
    el.classList.add('resizing');
    const onMove = (ev) => {
      f.w = Math.max(150, Math.min(420, startW + (ev.clientX - startX)));
      f.h = Math.max(180, Math.min(520, startH + (ev.clientY - startY)));
      el.style.width = f.w + 'px';
      el.style.height = f.h + 'px';
      renderThreads();
    };
    const onUp = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      el.classList.remove('resizing');
      save();
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
  });
}

function addNudgeRing(el) {
  const ring = document.createElement('div');
  ring.className = 'nudge-ring';
  const w = el.offsetWidth, h = el.offsetHeight;
  const cx = el.offsetLeft + w / 2;
  const cy = el.offsetTop + h / 2;
  const rw = w + 70, rh = h + 50;
  ring.style.left = (cx - rw / 2) + 'px';
  ring.style.top = (cy - rh / 2) + 'px';
  ring.style.width = rw + 'px';
  ring.style.height = rh + 'px';
  board.appendChild(ring);
}

function pinPoint(f) {
  return { x: (f.x || 200) + (f.w || 190) / 2, y: (f.y || 160) + 2 };
}

function renderThreads() {
  threadsSvg.innerHTML = '';
  const byId = Object.fromEntries(state.friends.map(f => [f.id, f]));
  const seen = new Set();
  for (const f of state.friends) {
    for (const other of (f.connections || [])) {
      const key = [f.id, other].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const g = byId[other];
      if (!g) continue;
      const a = pinPoint(f), b = pinPoint(g);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2 + 28;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#7F77DD');
      path.setAttribute('stroke-width', '2');
      threadsSvg.appendChild(path);
    }
  }
}

function updateEmptyStates() {
  $('#boardEmpty').classList.toggle('hidden', state.friends.length > 0);
}

function arrangeByOverdue() {
  const scroll = $('#boardScroll');
  const maxW = Math.max(190, ...state.friends.map(f => f.w || 190));
  const maxH = Math.max(230, ...state.friends.map(f => f.h || 230));
  const stepX = maxW + 30, stepY = maxH + 40;
  const cols = Math.max(1, Math.floor((scroll.clientWidth - 60) / stepX));
  const sorted = [...state.friends].sort((a, b) => daysSince(lastTalkedIso(b)) - daysSince(lastTalkedIso(a)));
  sorted.forEach((f, i) => {
    f.x = 40 + (i % cols) * stepX;
    f.y = 40 + Math.floor(i / cols) * stepY;
    f.rot = Math.round(Math.random() * 6 - 3);
  });
  save();
  renderBoard();
}

// who's overdue, per channel
function overdueReminders() {
  const textDays = state.settings.textOverdueDays || 30;
  const callDays = state.settings.callOverdueDays || 45;
  const text = [], call = [];
  for (const f of state.friends) {
    const dt = daysSinceOrNull(f.lastTexted);
    const dc = daysSinceOrNull(f.lastCalled);
    if (dt !== null && dt > textDays) text.push({ f, days: dt });
    if (dc !== null && dc > callDays) call.push({ f, days: dc });
  }
  text.sort((a, b) => b.days - a.days);
  call.sort((a, b) => b.days - a.days);
  return { text, call };
}

function openReminders() {
  const { text, call } = overdueReminders();
  if (!text.length && !call.length) return;
  const section = (title, items, icon) => items.length ? `
    <div class="rem-group">
      <div class="rem-title">${icon} ${title}</div>
      ${items.map(it => `<button class="rem-item" data-id="${it.f.id}"><span>${escapeHtml(it.f.name || 'Someone')}</span><span class="rem-days">${it.days} days</span></button>`).join('')}
    </div>` : '';
  openModal(`
    <button class="x-close" data-close>×</button>
    <h3>a little nudge</h3>
    <p class="sub">people it's been a while with. tap one to open them.</p>
    ${section('haven\'t texted in a while', text, '💬')}
    ${section('haven\'t called in a while', call, '📞')}
    <div class="row-btns"><button class="btn go" data-close>got it</button></div>
  `);
  modalRoot.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
  modalRoot.querySelectorAll('.rem-item').forEach(b => {
    b.onclick = () => { const f = state.friends.find(x => x.id === b.dataset.id); if (f) openDetail(f); };
  });
}

// ---------- drag ----------
function enableDrag(el, f) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    const origX = f.x || 200, origY = f.y || 160;
    let moved = false;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 4) { moved = true; el.classList.add('dragging'); }
      if (moved) {
        f.x = Math.max(0, origX + dx);
        f.y = Math.max(0, origY + dy);
        el.style.left = f.x + 'px';
        el.style.top = f.y + 'px';
        renderThreads();
      }
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.classList.remove('dragging');
      if (moved) { renderBoard(); save(); }
      else openDetail(f);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  });

  // drop an image onto a polaroid to set its photo
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.path) return;
    const filename = await window.api.importPhotoPath(file.path);
    if (filename) { f.photo = filename; delete photoCache[filename]; await save(); renderBoard(); }
  });
}

// ---------- modal plumbing ----------
const modalRoot = $('#modalRoot');
function closeModal() { modalRoot.innerHTML = ''; }
function openModal(innerHTML) {
  modalRoot.innerHTML = `<div class="overlay"><div class="modal"><div class="modal-inner">${innerHTML}</div></div></div>`;
  const overlay = $('.overlay', modalRoot);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) closeModal(); });
  return modalRoot;
}

// ---------- detail modal ----------
function openDetail(f) {
  const c = colorOf(f.color);
  const days = daysSince(lastTalkedIso(f));
  const dt = daysSinceOrNull(f.lastTexted);
  const dcl = daysSinceOrNull(f.lastCalled);
  const nb = nextBirthday(f.birthday);
  const bdayText = f.birthday
    ? `${fmtBirthday(f.birthday)} · ${bdayCountdown(daysUntil(nb))}`
    : 'no birthday saved';

  const pi = planInfo(f);
  let planHtml;
  if (pi) {
    const rel = pi.days < 0 ? `was ${Math.abs(pi.days)} day${Math.abs(pi.days) === 1 ? '' : 's'} ago` : bdayCountdown(pi.days);
    planHtml = `<div class="detail-plan"><span class="when">📅 ${escapeHtml(pi.label)} · ${rel}</span><button class="btn ghost" id="clearPlan" style="float:right;padding:4px 10px;">clear</button></div>`;
  } else {
    planHtml = `<div class="detail-plan"><span class="none">no plans set — add one in edit</span></div>`;
  }

  openModal(`
    <button class="x-close" data-close>×</button>
    <div class="detail-photo" id="detailPhoto" style="background:${c.bg};color:${c.text};">${(f.name||'?').charAt(0).toUpperCase()}</div>
    <h3>${escapeHtml(f.name || 'Someone')}</h3>
    <div class="detail-meta">
      <span>last talked <b>${dayLabel(days)}</b></span>
      <span>💬 <b>${dt === null ? 'no texts yet' : 'texted ' + dayLabel(dt)}</b></span>
      <span>📞 <b>${dcl === null ? 'no calls yet' : 'called ' + dayLabel(dcl)}</b></span>
      <span>🎂 <b>${escapeHtml(bdayText)}</b></span>
    </div>
    ${planHtml}

    <div class="field">
      <label>what did you talk about?</label>
      <textarea id="convo" placeholder="quick note to remember..."></textarea>
    </div>
    <div class="row-btns">
      <button class="btn go" id="textedToday">💬 texted today</button>
      <button class="btn go" id="calledToday">📞 called today</button>
      <button class="btn" id="justLog">just add a note</button>
    </div>

    <div class="log" id="log"></div>

    <div class="row-btns">
      <button class="btn" id="connect">connect to…</button>
      <button class="btn" id="edit">edit</button>
      <button class="btn danger" id="del">remove</button>
    </div>
  `);

  if (f.photo) getPhoto(f.photo).then(url => {
    if (!url) return;
    const box = $('#detailPhoto');
    box.textContent = '';
    box.style.backgroundImage = `url(${url})`;
    box.style.backgroundSize = 'cover';
    box.style.backgroundPosition = 'center';
  });

  renderLog(f);

  $('[data-close]', modalRoot).onclick = closeModal;
  const clearPlanBtn = $('#clearPlan', modalRoot);
  if (clearPlanBtn) clearPlanBtn.onclick = async () => { f.plan = null; await save(); renderBoard(); openDetail(f); };
  const markContact = async (channel) => {
    const now = new Date().toISOString();
    if (channel === 'texted') f.lastTexted = now; else f.lastCalled = now;
    f.lastContact = now;
    const txt = $('#convo').value.trim();
    (f.log = f.log || []).unshift({ date: now, text: txt ? `${channel}: ${txt}` : channel });
    if (txt) f.note = txt;
    if (f.plan && f.plan.date && daysUntil(new Date(f.plan.date)) <= 0) f.plan = null;
    await save(); renderBoard(); openDetail(f);
  };
  $('#textedToday', modalRoot).onclick = () => markContact('texted');
  $('#calledToday', modalRoot).onclick = () => markContact('called');
  $('#justLog', modalRoot).onclick = async () => {
    const txt = $('#convo').value.trim();
    if (!txt) return;
    (f.log = f.log || []).unshift({ date: new Date().toISOString(), text: txt });
    f.note = txt;
    await save(); renderBoard(); openDetail(f);
  };
  $('#connect', modalRoot).onclick = () => openConnect(f);
  $('#edit', modalRoot).onclick = () => openEditor(f);
  $('#del', modalRoot).onclick = async () => {
    if (!confirm(`Remove ${f.name || 'this person'} from your board?`)) return;
    state.friends = state.friends.filter(x => x.id !== f.id);
    state.friends.forEach(x => { if (x.connections) x.connections = x.connections.filter(id => id !== f.id); });
    await save(); renderBoard(); closeModal();
  };
}

function renderLog(f) {
  const wrap = $('#log', modalRoot);
  if (!wrap) return;
  const log = f.log || [];
  if (!log.length) { wrap.innerHTML = `<div class="log-empty">No notes yet. Add the first one above.</div>`; return; }
  wrap.innerHTML = log.map(item => `
    <div class="log-item">
      <div class="when">${new Date(item.date).toLocaleDateString()}</div>
      <div class="what">${escapeHtml(item.text)}</div>
    </div>`).join('');
}

// ---------- connect modal ----------
function openConnect(f) {
  const others = state.friends.filter(x => x.id !== f.id && !(f.connections || []).includes(x.id));
  const list = others.length
    ? others.map(o => `<button data-id="${o.id}">${escapeHtml(o.name || 'Someone')}</button>`).join('')
    : `<div class="none">Everyone else is already connected, or it's just them so far.</div>`;
  openModal(`
    <button class="x-close" data-close>×</button>
    <h3>thread ${escapeHtml(f.name || '')}</h3>
    <p class="sub">connect them to people they actually know, so your circles show up on the board.</p>
    <div class="connect-pick">${list}</div>
    <div class="row-btns"><button class="btn ghost" data-back>back</button></div>
  `);
  $('[data-close]', modalRoot).onclick = closeModal;
  $('[data-back]', modalRoot).onclick = () => openDetail(f);
  modalRoot.querySelectorAll('.connect-pick button[data-id]').forEach(btn => {
    btn.onclick = async () => {
      const oid = btn.dataset.id;
      (f.connections = f.connections || []).push(oid);
      const o = state.friends.find(x => x.id === oid);
      if (o) (o.connections = o.connections || []).push(f.id);
      await save(); renderBoard(); openDetail(f);
    };
  });
}

// ---------- editor modal ----------
function openEditor(existing) {
  const editing = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: uid(), name: '', birthday: null, note: '', color: 'pink', style: 'pin', photo: null,
        plan: null, log: [], connections: [], lastContact: new Date().toISOString(),
        lastTexted: new Date().toISOString(), lastCalled: null,
        x: 220 + Math.round(Math.random() * 680), y: 140 + Math.round(Math.random() * 420),
        rot: Math.round((Math.random() * 8 - 4)) };

  const swatches = PALETTE.map(p =>
    `<div class="swatch ${p.key === editing.color ? 'sel' : ''}" data-color="${p.key}" style="background:${p.bg};"></div>`
  ).join('');

  openModal(`
    <button class="x-close" data-close>×</button>
    <h3>${existing ? 'edit' : 'add someone'}</h3>
    <div class="field">
      <label>name</label>
      <input type="text" id="f-name" value="${escapeAttr(editing.name)}" placeholder="who is it?" />
    </div>
    <div class="field">
      <label>birthday (optional)</label>
      <input type="date" id="f-bday" value="${editing.birthday ? '2000-' + editing.birthday : ''}" />
    </div>
    <div class="field">
      <label>a note to keep on their card (optional)</label>
      <input type="text" id="f-note" value="${escapeAttr(editing.note || '')}" placeholder="owes me a coffee…" />
    </div>
    <div class="field">
      <label>next time you'll see them (optional)</label>
      <div style="display:flex; gap:8px;">
        <input type="date" id="f-plan-date" value="${editing.plan && editing.plan.date ? editing.plan.date : ''}" style="flex:1;" />
        <input type="text" id="f-plan-what" value="${escapeAttr(editing.plan ? (editing.plan.label || '') : '')}" placeholder="dinner, coffee…" style="flex:1;" />
      </div>
    </div>
    <div class="field">
      <label>last texted / last called (optional, edit anytime)</label>
      <div style="display:flex; gap:8px;">
        <input type="date" id="f-texted" value="${isoToDateInput(editing.lastTexted)}" style="flex:1;" />
        <input type="date" id="f-called" value="${isoToDateInput(editing.lastCalled)}" style="flex:1;" />
      </div>
    </div>
    <div class="field">
      <label>color</label>
      <div class="swatches" id="f-swatches">${swatches}</div>
    </div>
    <div class="field">
      <label>pinned how?</label>
      <div class="style-toggle" id="f-style">
        <button data-style="pin" class="${editing.style !== 'tape' ? 'sel' : ''}">pushpin</button>
        <button data-style="tape" class="${editing.style === 'tape' ? 'sel' : ''}">washi tape</button>
      </div>
    </div>
    <div class="field">
      <label>photo (optional)</label>
      <button class="btn" id="f-photo">${editing.photo ? 'change photo' : 'choose a photo'}</button>
      <span id="f-photo-name" style="font-size:12px;color:var(--ink-soft);margin-left:8px;">${editing.photo ? 'photo set' : 'no photo yet'}</span>
    </div>
    <div class="row-btns">
      <button class="btn go" id="f-save">save</button>
      <button class="btn ghost" data-close>cancel</button>
      ${existing ? '<button class="btn danger" id="f-del">remove</button>' : ''}
    </div>
  `);

  modalRoot.querySelectorAll('[data-close]').forEach(b => b.onclick = () => existing ? openDetail(existing) : closeModal());
  modalRoot.querySelectorAll('#f-swatches .swatch').forEach(s => {
    s.onclick = () => {
      editing.color = s.dataset.color;
      modalRoot.querySelectorAll('#f-swatches .swatch').forEach(x => x.classList.remove('sel'));
      s.classList.add('sel');
    };
  });
  modalRoot.querySelectorAll('#f-style button').forEach(b => {
    b.onclick = () => {
      editing.style = b.dataset.style;
      modalRoot.querySelectorAll('#f-style button').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });
  $('#f-photo', modalRoot).onclick = async () => {
    const filename = await window.api.importPhoto();
    if (filename) { editing.photo = filename; delete photoCache[filename]; $('#f-photo-name').textContent = 'photo set'; }
  };
  $('#f-save', modalRoot).onclick = async () => {
    editing.name = $('#f-name').value.trim() || 'Someone';
    editing.note = $('#f-note').value.trim();
    const bd = $('#f-bday').value; // yyyy-mm-dd
    editing.birthday = bd ? bd.slice(5) : null; // store mm-dd
    const pd = $('#f-plan-date').value;
    editing.plan = pd ? { date: pd, label: $('#f-plan-what').value.trim() || 'plans' } : null;
    editing.lastTexted = dateInputToIso($('#f-texted').value);
    editing.lastCalled = dateInputToIso($('#f-called').value);
    editing.lastContact = lastTalkedIso(editing) || editing.lastContact;
    const idx = state.friends.findIndex(x => x.id === editing.id);
    if (idx >= 0) state.friends[idx] = editing; else state.friends.push(editing);
    await save(); renderBoard(); closeModal();
  };
  const delBtn = $('#f-del', modalRoot);
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm(`Remove ${editing.name || 'this person'}?`)) return;
    state.friends = state.friends.filter(x => x.id !== editing.id);
    state.friends.forEach(x => { if (x.connections) x.connections = x.connections.filter(id => id !== editing.id); });
    await save(); renderBoard(); closeModal();
  };
}

// ---------- birthdays view ----------
function renderBirthdays() {
  const list = $('#birthdayList');
  const items = [];
  for (const f of state.friends) {
    if (f.birthday) {
      const next = nextBirthday(f.birthday);
      items.push({ f, date: next, kind: 'birthday', icon: '🎂', what: `${f.name || 'Someone'}'s birthday`, sub: fmtBirthday(f.birthday) });
    }
    const pi = planInfo(f);
    if (pi && pi.days >= 0) {
      items.push({ f, date: pi.date, kind: 'plan', icon: '📅', what: `${pi.label} with ${f.name || 'someone'}`, sub: pi.date.toLocaleDateString() });
    }
  }
  items.sort((a, b) => a.date - b.date);

  $('#birthdayEmpty').classList.toggle('hidden', items.length > 0);
  list.innerHTML = '';

  for (const it of items) {
    const f = it.f;
    const c = colorOf(f.color);
    const until = daysUntil(it.date);
    const card = document.createElement('div');
    card.className = 'bday-card' + (until <= 7 ? ' soon' : '');
    const initial = (f.name || '?').charAt(0).toUpperCase();
    card.innerHTML = `
      <div class="mini" style="background:${c.bg};color:${c.text};">${initial}</div>
      <div class="info">
        <div class="name">${it.icon} ${escapeHtml(it.what)}</div>
        <div class="date">${escapeHtml(it.sub)}</div>
      </div>
      <div class="count">${bdayCountdown(until)}</div>`;
    if (f.photo) getPhoto(f.photo).then(url => {
      if (!url) return;
      const mini = card.querySelector('.mini');
      mini.textContent = '';
      mini.style.backgroundImage = `url(${url})`;
      mini.style.backgroundSize = 'cover';
      mini.style.backgroundPosition = 'center';
    });
    card.onclick = () => openDetail(f);
    list.appendChild(card);
  }
}

// ---------- tabs ----------
function setView(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === name));
  $('#viewBoard').classList.toggle('is-active', name === 'board');
  $('#viewBirthdays').classList.toggle('is-active', name === 'birthdays');
  if (name === 'birthdays') renderBirthdays();
}

// ---------- escaping ----------
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// ---------- boot ----------
async function init() {
  state = await window.api.loadData();
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => setView(t.dataset.view));
  document.querySelectorAll('#addBtn, [data-add]').forEach(b => b.onclick = () => openEditor(null));
  const tidy = $('#tidyBtn');
  if (tidy) tidy.onclick = arrangeByOverdue;
  renderBoard();
  setTimeout(openReminders, 400);
}
init();
