// Records how code is written during a practice test, for the report's code
// playback, and spots two patterns reviewers look for: most of the code
// deleted and then a large block appearing in one go, and sustained typing
// faster than a person can type. Edits are sent in batches every few seconds.
const FLUSH_MS = 5000;
const RESET_GAP_MS = 120000;
const WINDOW_MS = 15000;
const FAST_CHARS_PER_SECOND = 15;

export function createRecorder({send, flag, clock = () => Date.now(), started = Date.now()}) {
  let buffer = [], timer = null, bigDeleteAt = null, typingFlagged = false, strokes = [];
  const t = () => Math.max(0, clock() - started);

  function schedule() {
    if (buffer.length >= 200) { flush(); return; }
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  }
  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!buffer.length) return Promise.resolve();
    const events = buffer;
    buffer = [];
    return Promise.resolve(send(events)).catch(() => { buffer = [...events, ...buffer].slice(-2000); });
  }

  // The full text when a language's editor is shown, so playback has a starting point.
  function snapshot(language, text) { buffer.push({t: t(), language, snapshot: text}); schedule(); }

  // source: 'paste' or 'ai' when the change came from a paste or an AI insert.
  function edit(language, changes, lengthAfter, source) {
    buffer.push({t: t(), language, c: changes.map(ch => [ch.rangeOffset, ch.rangeLength, ch.text]), ...(source ? {s: source} : {})});
    const deleted = changes.reduce((sum, ch) => sum + ch.rangeLength, 0);
    const inserted = changes.reduce((sum, ch) => sum + ch.text.length, 0);
    const lengthBefore = lengthAfter - inserted + deleted;
    if (deleted >= 200 && deleted >= 0.6 * lengthBefore) bigDeleteAt = Date.now();
    else if (inserted >= 200 && !source && bigDeleteAt && Date.now() - bigDeleteAt < RESET_GAP_MS) { flag('code-reset', {chars: inserted}); bigDeleteAt = null; }
    // Keystroke-sized inserts over the last fifteen seconds: a sustained rate
    // above what people type suggests a tool typing for you.
    if (!source && !typingFlagged && deleted === 0 && inserted > 0 && inserted <= 2) {
      const now = Date.now();
      strokes.push([now, inserted]);
      while (now - strokes[0][0] > WINDOW_MS) strokes.shift();
      const span = (now - strokes[0][0]) / 1000;
      const rate = strokes.reduce((sum, s) => sum + s[1], 0) / Math.max(span, 1);
      if (span >= 10 && rate >= FAST_CHARS_PER_SECOND) { typingFlagged = true; flag('typing-anomaly', {rate: Math.round(rate)}); }
    }
    schedule();
  }

  return {snapshot, edit, flush};
}

// Rebuilds the code at any recorded moment. events holds full snapshots
// ({t, language, snapshot}: at the start and on a language switch) and edits
// ({t, language, c: [[offset, length, text], ...]}), in order. Checkpoints every
// 200 events keep seeking fast in long sessions.
export function createPlayer(events = []) {
  const EVERY = 200;
  const apply = (state, e) => {
    const texts = {...state.texts};
    if (typeof e.snapshot === 'string') texts[e.language] = e.snapshot;
    else {
      let text = texts[e.language] ?? '';
      // Edits in one event refer to the same starting text, so apply them from the end backwards.
      for (const [offset, length, insert] of [...(e.c || [])].sort((a, b) => b[0] - a[0])) text = text.slice(0, offset) + insert + text.slice(offset + length);
      texts[e.language] = text;
    }
    return {texts, language: e.language};
  };
  const checkpoints = [];
  let state = {texts: {}, language: null};
  events.forEach((e, i) => { if (i % EVERY === 0) checkpoints.push(state); state = apply(state, e); });
  return {
    length: events.length,
    at(index) {
      const i = Math.max(-1, Math.min(events.length - 1, index));
      if (i < 0) return {language: null, text: ''};
      let s = checkpoints[Math.floor(i / EVERY)];
      for (let k = Math.floor(i / EVERY) * EVERY; k <= i; k++) s = apply(s, events[k]);
      return {language: s.language, text: s.language ? s.texts[s.language] ?? '' : ''};
    }
  };
}
