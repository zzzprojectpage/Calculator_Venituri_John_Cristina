// Banii Noștri · John & Cristina — logica interfeței.
import * as S from './sync.js';

const $ = (s) => document.querySelector(s);
const OWNERS = ['John', 'Cristina'];
const DEFAULT_PLANNED = 5000; // valoarea implicită din câmpul „Planificat”

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lei = (n) => Number(n || 0).toLocaleString('ro-RO') + ' lei';
const monthName = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const intOf = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : 0; };
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const rowValue = (r) => (r.actual === null || r.actual === undefined ? r.planned : r.actual);

let saveTimer = null;
let editingRowId = null;
let editingTrId = null;

/* ============================== pornire ============================== */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

if (S.loadCode()) {
  $('#codeInput').value = S.loadCode();
  enterApp().catch(() => showLogin());
}

function showLogin(msg) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  const err = $('#loginError');
  err.textContent = msg || '';
  err.classList.toggle('hidden', !msg);
}

function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
}

$('#loginBtn').addEventListener('click', async () => {
  const code = $('#codeInput').value.trim();
  if (!/^[a-f0-9]{64}$/i.test(code)) {
    showLogin('Codul trebuie să aibă 64 de caractere (hexazecimal).');
    return;
  }
  S.saveCode(code);
  try { await enterApp(); }
  catch (e) { S.clearCode(); showLogin(e.code && e.code.includes('ACCESS_DENIED') ? 'Cod greșit. Încearcă din nou.' : 'Nu mă pot conecta. Verifică internetul.'); }
});
$('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginBtn').click(); });

$('#lockBtn').addEventListener('click', () => { showLogin(); $('#codeInput').value = S.loadCode(); });
$('#statusChip').addEventListener('click', () => { if (S.state.localOnly) retryOnline(); });

async function enterApp() {
  S.state.code = S.loadCode();
  if (!S.state.code) throw new Error('NO_CODE');
  try { S.state.months = (await S.rpc('jc_months_list', { p_code: S.state.code })).map((m) => m.month); }
  catch (e) { if (e.code && e.code.includes('ACCESS_DENIED')) { S.clearCode(); throw e; } S.state.months = []; }
  if (!S.state.month) S.state.month = S.curMonth();
  showApp();
  await loadMonth(S.state.month);
}

/* ============================== luni / citire ============================== */
async function loadMonth(m) {
  S.state.month = m;
  try {
    const j = await S.rpc('jc_read', { p_code: S.state.code, p_month: m });
    S.state.data = j.data || { rows: [], transfers: [] };
    S.state.version = j.version;
    S.state.seeded = !!j.seeded;
    S.state.localOnly = false;
    if (j.version > 0 && !S.state.months.includes(m)) S.state.months.push(m);
  } catch (e) {
    if (e.code && e.code.includes('ACCESS_DENIED')) { S.clearCode(); showLogin('Codul nu mai este valid.'); return; }
    const loc = S.readLocal(m);
    if (loc) { S.state.data = loc.data; S.state.localOnly = true; }
    else if (e.code === 'NETWORK') { S.state.localOnly = true; }
    else throw e;
  }
  S.state.dirty = false;
  renderAll();
}

function buildMonthOptions() {
  const cur = S.curMonth();
  const saved = S.state.months.slice().sort();
  let start = saved[0] || S.monthShift(cur, -6);
  if (start > cur) start = S.monthShift(cur, -6);
  let end = saved[saved.length - 1] || S.monthShift(cur, 6);
  const far = S.monthShift(cur, 11);
  if (end < far) end = far;
  const sel = $('#monthSelect');
  sel.innerHTML = '';
  let m = start;
  for (let i = 0; i < 60 && m <= end; i++) {
    const o = document.createElement('option');
    o.value = m; o.textContent = monthName(m);
    if (m === S.state.month) o.selected = true;
    sel.appendChild(o);
    m = S.monthShift(m, 1);
  }
}

$('#monthSelect').addEventListener('change', (e) => guardUnload(() => loadMonth(e.target.value)));
$('#prevMonth').addEventListener('click', () => guardUnload(() => loadMonth(S.monthShift(S.state.month, -1))));
$('#nextMonth').addEventListener('click', () => guardUnload(() => loadMonth(S.monthShift(S.state.month, 1))));
$('#todayBtn').addEventListener('click', () => guardUnload(() => loadMonth(S.curMonth())));

function guardUnload(fn) {
  if (S.state.dirty) saveNow().then(fn).catch(fn);
  else fn();
}

/* ============================== calcule ============================== */
function calc() {
  const d = S.state.data;
  const income = { John: 0, Cristina: 0 }, planned = { John: 0, Cristina: 0 };
  const paid = { John: 0, Cristina: 0 };
  let expenseTotal = 0, incomeTotal = 0;
  for (const r of d.rows) {
    if (r.kind === 'income') {
      income[r.owner] += rowValue(r);
      planned[r.owner] += Number(r.planned || 0);
      incomeTotal += rowValue(r);
    } else {
      expenseTotal += rowValue(r);
      paid[r.owner] += rowValue(r);
    }
  }
  const contrib = { John: paid.John, Cristina: paid.Cristina };
  for (const t of d.transfers) {
    if (OWNERS.includes(t.from)) contrib[t.from] += Number(t.amount || 0);
  }
  const diff = contrib.John - contrib.Cristina; // >0 => John a plătit mai mult pentru comun
  const split = expenseTotal > 0 || d.transfers.length > 0
    ? { from: diff < 0 ? 'John' : 'Cristina', to: diff < 0 ? 'Cristina' : 'John', amount: Math.round(Math.abs(diff) / 2) }
    : null;
  return { income, planned, paid, expenseTotal, incomeTotal, split, hasContent: d.rows.length + d.transfers.length > 0 };
}

/* ============================== randare ============================== */
function renderAll() {
  buildMonthOptions();
  $('#todayBtn').classList.toggle('hidden', S.state.month === S.curMonth());
  renderSummary();
  renderLists();
  renderStatus();
}

function renderSummary() {
  const c = calc();
  const main = $('#splitMain'), note = $('#splitNote');
  if (!c.hasContent) {
    main.innerHTML = '—';
    note.textContent = `${monthName(S.state.month)} e goală — apasă „+” ca să adaugi venituri și cheltuieli.`;
  } else if (!c.split || c.split.amount === 0) {
    main.innerHTML = 'Cheltuieli la echilibru';
    note.textContent = c.expenseTotal > 0 ? `Fiecare acoperă jumătate din ${lei(c.expenseTotal)}.` : 'Nicio cheltuială comună în luna aceasta.';
  } else {
    const toCls = c.split.to === 'John' ? 'to-j' : 'to-c';
    main.innerHTML = `<span class="from">${c.split.from}</span> → <span class="${toCls}">${c.split.to}</span> ${lei(c.split.amount)}`;
    note.textContent = `Așa ajunge fiecare la jumătate din cheltuielile comune de ${lei(c.expenseTotal)}.`;
  }
  $('#planJohn').textContent = lei(c.planned.John);
  $('#planCristina').textContent = lei(c.planned.Cristina);
  $('#incomeTotal').textContent = lei(c.incomeTotal);
  $('#incomeTotal').classList.toggle('pos', c.incomeTotal > 0);
  $('#expenseTotal').textContent = lei(c.expenseTotal);
}

function dateChip(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d) ? '' : d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

function itemHTML(r, kind) {
  const ownerCls = r.owner === 'John' ? 'j' : 'c';
  const unconf = r.actual === null || r.actual === undefined;
  const valCls = kind === 'income' ? 'inc' : 'exp';
  const sign = kind === 'income' ? '+' : '−';
  return `<button class="item" data-id="${esc(r.id)}">
    <span class="tag ${ownerCls}"></span>
    <span class="main">
      <span class="label">${esc(r.label)}</span>
      <span class="meta"><span class="badge">${esc(r.owner)}</span>${unconf ? '<span class="badge unconf">neconfirmat</span>' : ''}${dateChip(r.date) ? `<span>${dateChip(r.date)}</span>` : ''}</span>
    </span>
    <span class="vals">
      <span class="actual ${valCls}">${sign} ${lei(rowValue(r))}</span>
      <span class="planned">plan ${lei(r.planned)}</span>
    </span>
    <span class="arrow">›</span>
  </button>`;
}

function transferHTML(t) {
  const other = t.from === 'John' ? 'Cristina' : 'John';
  return `<button class="item" data-tid="${esc(t.id)}">
    <span class="tag ${t.from === 'John' ? 'j' : 'c'}"></span>
    <span class="main">
      <span class="label">Către ${esc(other)}</span>
      <span class="meta"><span class="badge">${esc(t.from)} dă</span>${dateChip(t.date) ? `<span>${dateChip(t.date)}</span>` : ''}</span>
    </span>
    <span class="vals"><span class="actual">${lei(t.amount)}</span></span>
    <span class="arrow">›</span>
  </button>`;
}

function renderLists() {
  const f = S.state.filter;
  const d = S.state.data;
  const matchOwner = (o) => f === 'all' || f === o;
  const showKind = (k) => f === 'all' || f === k || f === 'John' || f === 'Cristina';

  const inc = d.rows.filter((r) => r.kind === 'income' && matchOwner(r.owner) && showKind('income'));
  const exp = d.rows.filter((r) => r.kind === 'expense' && matchOwner(r.owner) && showKind('expense'));
  // Transferurile se văd la filtrele „Toate/John/Cristina”, nu la cele de tip.
  const shownTr = (f === 'all' || f === 'John' || f === 'Cristina') ? d.transfers : [];

  $('#listIncome').innerHTML = inc.map((r) => itemHTML(r, 'income')).join('');
  $('#listExpense').innerHTML = exp.map((r) => itemHTML(r, 'expense')).join('');
  $('#listTransfer').innerHTML = shownTr.map(transferHTML).join('');
  $('#secIncome').classList.toggle('hidden', inc.length === 0);
  $('#secExpense').classList.toggle('hidden', exp.length === 0);
  $('#secTransfer').classList.toggle('hidden', shownTr.length === 0);
  $('#sumIncome').textContent = inc.length ? lei(inc.reduce((a, r) => a + rowValue(r), 0)) : '';
  $('#sumExpense').textContent = exp.length ? lei(exp.reduce((a, r) => a + rowValue(r), 0)) : '';
  $('#sumTransfer').textContent = '';

  const any = inc.length + exp.length + shownTr.length > 0;
  $('#emptyState').classList.toggle('hidden', any);
  bindItemEvents();
}

function bindItemEvents() {
  document.querySelectorAll('#listIncome .item, #listExpense .item').forEach((el) => {
    el.addEventListener('click', () => {
      const r = S.state.data.rows.find((x) => x.id === el.dataset.id);
      if (r) openRowModal(r);
    });
  });
  document.querySelectorAll('#listTransfer .item').forEach((el) => {
    el.addEventListener('click', () => {
      const t = S.state.data.transfers.find((x) => x.id === el.dataset.tid);
      if (t) openTrModal(t);
    });
  });
}

$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('.fbtn');
  if (!b) return;
  S.state.filter = b.dataset.filter;
  document.querySelectorAll('#filters .fbtn').forEach((x) => x.classList.toggle('active', x === b));
  renderLists();
});

/* ============================== status / salvare ============================== */
function renderStatus(msgOverride, clsOverride) {
  const chip = $('#statusChip');
  chip.className = 'chip ' + (clsOverride || '');
  chip.textContent = msgOverride !== null && msgOverride !== undefined ? msgOverride
    : S.state.localOnly ? 'Mod local'
    : S.state.dirty ? 'Nesalvat…'
    : S.state.lastSavedAt ? `Salvat ${S.state.lastSavedAt}`
    : 'Sincronizat';
  if (!clsOverride && S.state.localOnly) chip.className = 'chip off';
  else if (!clsOverride && S.state.dirty) chip.className = 'chip warn';
  else if (!clsOverride && S.state.lastSavedAt) chip.className = 'chip ok';
}

function markDirty() {
  S.state.dirty = true;
  renderStatus();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow().catch(() => {}), 1600);
}

async function saveNow() {
  if (!S.state.dirty) return;
  S.state.dirty = false;
  if (S.state.localOnly) { S.saveLocal(S.state.month, S.state.data); renderStatus('Mod local', 'off'); return; }
  renderStatus('Se salvează…', 'warn');
  try {
    const j = await S.rpc('jc_save', {
      p_code: S.state.code, p_month: S.state.month, p_data: S.state.data, p_version: S.state.version, p_carry: true,
    });
    S.state.version = j.version;
    S.state.lastSavedAt = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    if (!S.state.months.includes(S.state.month)) { S.state.months.push(S.state.month); buildMonthOptions(); }
    renderStatus();
    if (j.propagated > 0) toast(`Plan nou copiat și în ${j.propagated} ${j.propagated === 1 ? 'lună' : 'luni'} următoare.`, 'ok');
  } catch (e) {
    S.state.dirty = true;
    if (e.code === 'NETWORK') {
      S.state.localOnly = true;
      S.saveLocal(S.state.month, S.state.data);
      renderStatus('Mod local', 'off');
      toast('Fără internet — salvat doar pe acest telefon.', 'err');
    } else if (e.code && e.code.includes('CONFLICT')) {
      toast('Cineva a salvat între timp — se reîncarcă luna.', 'err');
      await loadMonth(S.state.month);
    } else {
      renderStatus('Eroare', 'off');
      toast('Salvare eșuată: ' + (e.code || 'eroare'), 'err');
    }
  }
}

async function retryOnline() {
  renderStatus('Reconectare…', 'warn');
  try {
    const j = await S.rpc('jc_read', { p_code: S.state.code, p_month: S.state.month });
    S.state.localOnly = false;
    if (j.version !== S.state.version) {
      toast('Pe server există date diferite de cele locale — păstrate ambele: serverul se vede după reîncărcare, al tău e „Nesalvat”.', 'err');
      await loadMonth(S.state.month); // serverul e sursa; snapshotul local rămâne în telefon
      return;
    }
    await saveNow();
    if (S.state.dirty) renderStatus('Nesalvat…', 'warn'); else toast('Din nou sincronizat.', 'ok');
  } catch { renderStatus('Mod local', 'off'); }
}

$('#saveBtn').addEventListener('click', () => saveNow());

/* ============================== modale ============================== */
function openOverlay(sel) { $(sel).classList.remove('hidden'); }
function closeOverlays() { $('#modalRow').classList.add('hidden'); $('#modalTransfer').classList.add('hidden'); }
document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) closeOverlays(); }));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlays(); });
document.querySelectorAll('.closeRow, .closeTr').forEach((b) => b.addEventListener('click', closeOverlays));

function syncRowCaptions() {
  const kind = document.querySelector('input[name="rowKind"]:checked').value;
  const exp = kind === 'expense';
  $('#ownerCaption').textContent = exp ? 'Din contul cui s-a plătit? Cheltuielile se împart egal.' : 'Al cui venit e?';
  $('#actualCaption').textContent = exp ? 'Plătit efectiv (lei)' : 'Încasat efectiv (lei)';
  $('#plannedCaption').textContent = 'Planificat (lei)';
}
document.querySelectorAll('input[name="rowKind"]').forEach((r) => r.addEventListener('change', syncRowCaptions));

function openRowModal(row) {
  editingRowId = row ? row.id : null;
  $('#rowTitle').textContent = row ? 'Editează poziția' : 'Adaugă poziție';
  $('#rowLabel').value = row ? row.label : '';
  document.querySelector(`input[name="rowKind"][value="${row ? row.kind : 'income'}"]`).checked = true;
  document.querySelector(`input[name="rowOwner"][value="${row ? row.owner : 'John'}"]`).checked = true;
  $('#rowPlanned').value = row ? row.planned : DEFAULT_PLANNED;
  $('#rowActual').value = row && row.actual !== null && row.actual !== undefined ? row.actual : '';
  $('#rowDate').value = row ? row.date || '' : todayISO();
  $('#rowDelete').classList.toggle('hidden', !row);
  syncRowCaptions();
  openOverlay('#modalRow');
  setTimeout(() => $('#rowLabel').focus(), 60);
}

$('#rowApply').addEventListener('click', () => {
  const label = $('#rowLabel').value.trim();
  if (!label) { toast('Scrie o denumire.', 'err'); return; }
  const row = {
    id: editingRowId || uid('r'),
    owner: document.querySelector('input[name="rowOwner"]:checked').value,
    kind: document.querySelector('input[name="rowKind"]:checked').value,
    label: label.slice(0, 100),
    planned: intOf($('#rowPlanned').value === '' ? DEFAULT_PLANNED : $('#rowPlanned').value),
    actual: $('#rowActual').value === '' ? null : intOf($('#rowActual').value),
    date: $('#rowDate').value || '',
  };
  const rows = S.state.data.rows;
  const i = rows.findIndex((r) => r.id === row.id);
  if (i >= 0) rows[i] = row; else rows.push(row);
  closeOverlays(); markDirty(); renderSummary(); renderLists();
});

$('#rowDelete').addEventListener('click', () => {
  if (!editingRowId || !confirm('Ștergi această poziție din lună?')) return;
  S.state.data.rows = S.state.data.rows.filter((r) => r.id !== editingRowId);
  closeOverlays(); markDirty(); renderSummary(); renderLists();
});

function openTrModal(tr) {
  editingTrId = tr ? tr.id : null;
  $('#trTitle').textContent = tr ? 'Editează transferul' : 'Transfer între conturi';
  document.querySelector(`input[name="trFrom"][value="${tr ? tr.from : 'John'}"]`).checked = true;
  $('#trAmount').value = tr ? tr.amount : '';
  $('#trDate').value = tr && tr.date ? tr.date : todayISO();
  $('#trDelete').classList.toggle('hidden', !tr);
  openOverlay('#modalTransfer');
}

$('#trApply').addEventListener('click', () => {
  const amount = intOf($('#trAmount').value);
  if (amount < 1) { toast('Scrie o sumă mai mare ca zero.', 'err'); return; }
  if (!$('#trDate').value) { toast('Alege data transferului.', 'err'); return; }
  const t = { id: editingTrId || uid('t'), from: document.querySelector('input[name="trFrom"]:checked').value, amount, date: $('#trDate').value };
  const list = S.state.data.transfers;
  const i = list.findIndex((x) => x.id === t.id);
  if (i >= 0) list[i] = t; else list.push(t);
  closeOverlays(); markDirty(); renderSummary(); renderLists();
});

$('#trDelete').addEventListener('click', () => {
  if (!editingTrId || !confirm('Ștergi acest transfer?')) return;
  S.state.data.transfers = S.state.data.transfers.filter((t) => t.id !== editingTrId);
  closeOverlays(); markDirty(); renderSummary(); renderLists();
});

$('#addRowBtn').addEventListener('click', () => openRowModal(null));
$('#emptyAdd').addEventListener('click', () => openRowModal(null));
$('#addTransferBtn').addEventListener('click', () => openTrModal(null));

/* ============================== toast ============================== */
let toastTimer = null;
function toast(msg, cls) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + (cls || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 4200);
}

window.addEventListener('beforeunload', (e) => {
  if (S.state.dirty) { S.saveLocal(S.state.month, S.state.data); }
});
