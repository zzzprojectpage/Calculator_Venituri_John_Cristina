// Stratul de date: Supabase RPC (funcțiile jc_*) + rezervă locală pe dispozitiv.
const CFG = window.JC_CONFIG || {};
const LS_CODE = 'bn_code_v1';
const LS_LOCAL = 'bn_local_v1';

export const state = {
  code: '',
  month: '',
  data: { rows: [], transfers: [] },
  version: 0,
  seeded: false,
  months: [],      // luni salvate pe server
  dirty: false,
  localOnly: false,
  lastSavedAt: null,
  filter: 'all',
};

export function curMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthShift(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function rpc(fn, args) {
  return fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': CFG.key,
      'Authorization': `Bearer ${CFG.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
    .then((r) => r.text().then((txt) => ({ ok: r.ok, j: safeParse(txt) })))
    .then(({ ok, j }) => {
      if (!ok) {
        const e = new Error((j && j.message) || 'SERVER');
        e.code = (j && j.message) || 'SERVER';
        throw e;
      }
      return j;
    })
    .catch((e) => {
      if (e.code) throw e;
      const net = new Error('NETWORK');
      net.code = 'NETWORK';
      throw net;
    });
}

function safeParse(txt) {
  try { return JSON.parse(txt); } catch { return { message: txt.slice(0, 200) }; }
}

export function saveCode(c) { localStorage.setItem(LS_CODE, c); }
export function loadCode() { return localStorage.getItem(LS_CODE) || ''; }
export function clearCode() { localStorage.removeItem(LS_CODE); }

// Rezervă locală (mod offline): snapshot pe lună, format identic cu serverul.
export function saveLocal(month, data) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_LOCAL) || '{}');
    all[month] = { data, at: Date.now() };
    localStorage.setItem(LS_LOCAL, JSON.stringify(all));
  } catch { /* plin / privat: ignoră */ }
}

export function readLocal(month) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_LOCAL) || '{}');
    return all[month] || null;
  } catch { return null; }
}
