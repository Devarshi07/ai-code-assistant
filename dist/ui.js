// Small DOM and API helpers shared by the practice UI.
export const $ = id => document.getElementById(id);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    // The CSP blocks inline style attributes; CSSOM assignment is allowed.
    else if (key === 'style') node.style.cssText = value;
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : String(child));
  return node;
}

export async function api(url, data, options = {}) {
  const response = await fetch(url, data !== undefined ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data), ...options} : options);
  let result;
  try { result = await response.json(); } catch { throw new Error(`Request failed (${response.status}).`); }
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

export async function waitJob(value, onProgress = () => {}) {
  if (!value || !value.job) return value;
  for (;;) {
    const state = await api('/api/job?id=' + value.job);
    if (state.message) onProgress(state.message);
    if (state.status === 'done') return state.result;
    if (state.status === 'error') throw new Error(state.error);
    await new Promise(resolve => setTimeout(resolve, 900));
  }
}

let noticeTimer;
export function notify(text, kind = 'info') {
  const node = $('notice');
  node.textContent = text;
  node.dataset.kind = kind;
  node.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { node.hidden = true; }, kind === 'error' ? 9000 : 5000);
}

export async function busy(button, action, label) {
  const previous = button.innerHTML;
  button.disabled = true;
  if (label) button.textContent = label;
  try { return await action(); }
  catch (error) { notify(error.message, 'error'); }
  finally { button.disabled = false; button.innerHTML = previous; }
}

export function clock(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function confirmDialog({title, body, confirm = 'Continue', cancel = 'Cancel', danger = false}) {
  return new Promise(resolve => {
    let done = false;
    // Resolve from the buttons directly: the dialog close event is deferred while a tab is hidden.
    const finish = value => {
      if (done) return;
      done = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    const dialog = el('dialog', {class: 'dialog small'},
      el('h2', {text: title}),
      typeof body === 'string' ? el('p', {text: body}) : body,
      el('div', {class: 'dialog-actions'},
        el('button', {class: 'button ghost', text: cancel, onclick: () => finish(false)}),
        el('button', {class: `button ${danger ? 'danger' : 'primary'}`, text: confirm, onclick: () => finish(true)})));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    dialog.addEventListener('close', () => finish(false));
    document.body.append(dialog);
    dialog.showModal();
  });
}

// Drag handle that resizes a pane by setting a CSS variable on root; sizes persist under storeKey.
export function splitter(root, handle, variable, measure, min, max, storeKey = 'dg-ide-sizes') {
  handle.addEventListener('pointerdown', start => {
    start.preventDefault();
    handle.setPointerCapture(start.pointerId);
    handle.classList.add('dragging');
    const move = e => root.style.setProperty(variable, Math.round(Math.min(max, Math.max(min, measure(e.clientX, e.clientY)))) + 'px');
    const up = () => {
      handle.classList.remove('dragging');
      handle.removeEventListener('pointermove', move);
      const sizes = store.get(storeKey, {});
      sizes[variable] = parseInt(root.style.getPropertyValue(variable), 10);
      store.set(storeKey, sizes);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up, {once: true});
    handle.addEventListener('pointercancel', up, {once: true});
  });
}

export const store = {
  get(key, fallback = null) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};

export const icons = {
  file: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5l3.5 3.5v9.5h-8.5z M9 1.5V5h3.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  folder: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.5h4.5l1.5 1.5h7v8.5h-13z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  key: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h6l2 2v7h-8z M5 7h3.5M5 9.5h3.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M10.5 1.5h3v3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  spark: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.6 4.4L14 7.5l-4.4 1.6L8 13.5l-1.6-4.4L2 7.5l4.4-1.6z" fill="currentColor"/></svg>',
  send: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8l11.5-5.5L9 14l-1.5-4.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bulb: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 11.5h5M6.3 14h3.4M8 1.8a4.2 4.2 0 0 0-2.5 7.6c.5.4.8.9.8 1.6v.5h3.4V11c0-.7.3-1.2.8-1.6A4.2 4.2 0 0 0 8 1.8z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3 10.5V3.8C3 3.1 3.6 2.5 4.3 2.5H10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  moon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.8A5.8 5.8 0 0 1 6.2 2.5a5.8 5.8 0 1 0 7.3 7.3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3 3l1.3 1.3M11.7 11.7L13 13M3 13l1.3-1.3M11.7 4.3L13 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.2L8 2.5l5.5 4.7V13.5h-3.7V9.8H6.2v3.7H2.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  code: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9 3l-2 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  repo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h8.5v9.5H5a1.5 1.5 0 0 0 0 3h7M3.5 2.5v11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 5.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  mic: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="6" y="1.8" width="4" height="7.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.8 7.6a4.2 4.2 0 0 0 8.4 0M8 11.8v2.4M5.8 14.2h4.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  micOff: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="6" y="1.8" width="4" height="7.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.8 7.6a4.2 4.2 0 0 0 8.4 0M8 11.8v2.4M2.5 2.5l11 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  speaker: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.8 5.5a3.5 3.5 0 0 1 0 5M12.6 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 6l3.5 4M14 6l-3.5 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  history: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8M2.2 2.6v2.6h2.6M8 5v3.2l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.8C6.6 2.8 4.5 2.5 2.5 2.8v9.7c2-.3 4.1 0 5.5 1 1.4-1 3.5-1.3 5.5-1V2.8c-2-.3-4.1 0-5.5 1zM8 3.8v9.7" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  agent: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="5" width="10" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 2.2V5M6 9h.01M10 9h.01M1.5 8.5v2M14.5 8.5v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4h7.5M6 8h7.5M6 12h7.5M2.5 4h.01M2.5 8h.01M2.5 12h.01" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  chat: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7.5H7l-3 2.5V11H2.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  caret: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6.5L8 10l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ban: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4.2 11.8l7.6-7.6" stroke="currentColor" stroke-width="1.4"/></svg>',
  restore: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H5M5.5 3.5L2.5 6.5l3 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  diff: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2.5v6M2 5.5h6M8 12.5h6M3 14l10-12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  terminal: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 6.5L6.5 8.2 4.5 10M8 10.2h3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  slash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5l-5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  upload: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v3h11v-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7M2.5 2.5v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  expand: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  panel: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 2.5v11" stroke="currentColor" stroke-width="1.2"/></svg>',
  trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  refresh: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13.2 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  user: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.5" r="2.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.8 14a5.2 5.2 0 0 1 10.4 0" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  flag: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14V2.5M3.5 3h8l-1.5 3 1.5 3h-8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  globe: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.2 8h11.6M8 2.2c1.8 1.6 2.6 3.5 2.6 5.8S9.8 12.2 8 13.8C6.2 12.2 5.4 10.3 5.4 8S6.2 3.8 8 2.2z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'
};

export function icon(name, className = 'icon') {
  return el('span', {class: className, html: icons[name] || ''});
}

export const DIFFICULTY_CLASS = {Easy: 'easy', Medium: 'medium', Hard: 'hard'};
export const KIND_LABEL = {bug: 'Debug', feature: 'Build', optimize: 'Optimize'};
export const VERDICT_CLASS = {'Strong Hire': 'strong', Hire: 'hire', 'Lean Hire': 'lean', 'Lean No Hire': 'lean-no', 'No Hire': 'no'};
