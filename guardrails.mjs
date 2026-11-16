// Guardrails for AI help where full solutions are off: Guided help, guarded
// practice tests and the mock interviewer. The prompt states the rules; this
// module enforces them on the reply stream, so an answer that ignores them is
// cut before the candidate sees it.
export const GUIDED_CODE_LINES = 8;
export const INTERVIEWER_CODE_LINES = 4;

const SOLUTION_REQUEST = [
  /\b(full|complete|entire|whole|final|working|finished)\s+(solution|code|program|implementation|answer|function)\b/i,
  /\b(write|give|show|send|paste|provide|generate)\s+(me\s+)?(the\s+|a\s+|your\s+)?(full\s+|complete\s+|entire\s+|whole\s+)?(solution|code|implementation)\b/i,
  /\bsolve\s+(it|this|the\s+(problem|question|task))\b/i,
  /\b(just|only)\s+(give|write|show|tell)\s+me\b/i,
  /\bwhat\s+is\s+the\s+(answer|solution)\b/i
];
const INJECTION = [
  /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(instructions?|rules?|prompts?|guardrails?|restrictions?|system)\b/i,
  /\b(system|developer)\s+(prompt|message|mode)\b/i,
  /\b(jailbreak|unfiltered|unrestricted)\b|\bDAN\b/,
  /\byou\s+are\s+now\b|\bpretend\s+(to\s+be|you\s+are)\b|\bact\s+as\s+(an?\s+)?(unrestricted|different|new)\b|\brole-?play\b/i,
  /\b(guided|guarded)\s+(help|mode)\s+(is\s+)?(off|disabled|over)\b|\bfull\s+help\s+(is\s+)?(on|enabled|allowed)\b/i,
  /<\/?(system|candidate_code|latest_run|context)\b/i
];

// Flags requests for a complete solution and attempts to change the assistant's rules.
export function inspectRequest(text) {
  const t = String(text || '');
  return {solution: SOLUTION_REQUEST.some(r => r.test(t)), injection: INJECTION.some(r => r.test(t))};
}

// A fenced block that text inside can't close early, however many backticks it contains.
export function fence(text, language = '') {
  const body = String(text ?? '');
  const longest = Math.max(2, ...[...body.matchAll(/`+/g)].map(m => m[0].length));
  const bar = '`'.repeat(longest + 1);
  return `${bar}${language}\n${body}${body.endsWith('\n') ? '' : '\n'}${bar}`;
}

const OPEN_FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;
const CODE_WORD = /^\s*(def|class|for|while|if|elif|else|return|import|from|function|const|let|var|public|private|protected|static|final|int|long|double|float|bool|boolean|char|void|auto|vector|string|String|func|package|#include|using|try|catch|except|switch|case|struct|fn|impl|print|println|printf|console|System|std|Map|List|Set|HashMap|ArrayList|throw|raise|yield|lambda|async|await|with)\b/;
const looksLikeCode = line => !LIST_ITEM.test(line) && (/^(\s{4,}|\t)\S/.test(line) || CODE_WORD.test(line) || /[;{}]\s*$/.test(line) || /^\s*[}\])]/.test(line) || /^\s*\w+(\.\w+)*\s*(\[[^\]]*\])?\s*(=|\+=|-=|\*=|:=)\s*\S/.test(line));

// Decides from its first characters whether a line can be streamed straight away as prose.
function proseStart(text) {
  if (/^\s/.test(text) || /^[`~{}()[\]<;=]/.test(text)) return false;
  if (/^#+$/.test(text) || /^#+[^#\s]/.test(text)) return /^#+\s/.test(text);
  if (/^(\*\*|__|\*|_)[A-Za-z]/.test(text)) return true;
  if (/^[-*+>|!]/.test(text)) return text.length > 1 && /^[-*+>|!]+\s/.test(text);
  const word = /^[A-Za-z_]\w*/.exec(text);
  if (word) {
    if (word[0].length === text.length && text.length < 16) return false;
    return !CODE_WORD.test(text) && !/^\w+(\.\w+)*\s*(=|\(|\[)/.test(text);
  }
  return /^\d/.test(text) ? /^\d+[.)\s]/.test(text) : false;
}

const normLine = line => line.replace(/\s+/g, '').replace(/;$/, '');
const codeLines = code => String(code).split('\n').map(normLine).filter(l => l.length >= 8 && !/^(\/\/|#|\*|\/\*|"""|''')/.test(l));
const TOKEN = /[A-Za-z_]\w*|\d+|[^\sA-Za-z_\d]/g;
function shingles(code, n = 6) {
  const t = String(code).match(TOKEN) || [];
  const out = new Set();
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n).join(' '));
  return out;
}

// references: reference solutions; templates: the starter code, which the
// candidate already has and which the reference solutions repeat.
export function referenceMatcher(references = [], templates = []) {
  const skipLines = new Set(templates.flatMap(codeLines));
  const skipShingles = new Set(templates.flatMap(t => [...shingles(t)]));
  const lines = new Set(references.flatMap(codeLines).filter(l => !skipLines.has(l)));
  const grams = new Set(references.flatMap(r => [...shingles(r)]).filter(s => !skipShingles.has(s)));
  return code => {
    const mine = codeLines(code);
    if (mine.length >= 3) {
      const hits = mine.filter(l => lines.has(l)).length;
      if (hits >= 3 && hits / mine.length >= 0.5) return true;
    }
    const s = shingles(code);
    if (s.size >= 12) {
      let hit = 0;
      for (const x of s) if (grams.has(x)) hit++;
      if (hit / s.size >= 0.6) return true;
    }
    return false;
  };
}

// A streaming filter. push(delta) and end() return the text that may be shown.
// Prose streams through at once; code (fenced, or unfenced code-like lines) is
// held until the block ends, then shown or replaced by a notice.
export function createOutputGuard({maxLines = GUIDED_CODE_LINES, matcher = null, label = 'Guided help'} = {}) {
  let partial = '', streamed = 0, fenceOpen = null, run = [], redactions = 0;

  const verdict = lines => {
    const body = lines.filter(l => l.trim() && !OPEN_FENCE.test(l));
    if (body.length > maxLines) return 'long';
    if (matcher && body.length && matcher(body.join('\n'))) return 'reference';
    return null;
  };
  const notice = reason => {
    redactions++;
    return `\n> **Code hidden by the AI guardrail.** ${reason === 'long' ? `${label} shows at most ${maxLines} lines of code at a time. Ask about one step, or for a hint.` : 'It was too close to the full solution.'}\n\n`;
  };
  const flushRun = () => {
    if (!run.length) return '';
    const lines = run;
    run = [];
    let tail = '';
    while (lines.length && !lines.at(-1).trim()) tail = lines.pop() + tail;
    const why = verdict(lines);
    return (why ? notice(why) : lines.join('')) + tail;
  };
  const closeFence = lines => { const why = verdict(lines.slice(1, -1)); return why ? notice(why) : lines.join(''); };

  function line(text) {
    const bare = text.replace(/\r?\n$/, '');
    if (fenceOpen) {
      fenceOpen.lines.push(text);
      const m = /^\s*(`{3,}|~{3,})\s*$/.exec(bare);
      if (m && m[1][0] === fenceOpen.char && m[1].length >= fenceOpen.len) { const out = closeFence(fenceOpen.lines); fenceOpen = null; return out; }
      return '';
    }
    const open = OPEN_FENCE.exec(bare);
    if (open) { const out = flushRun(); fenceOpen = {char: open[1][0], len: open[1].length, lines: [text]}; return out; }
    if (looksLikeCode(bare)) { run.push(text); return ''; }
    if (!bare.trim() && run.length) { run.push(text); return ''; }
    return flushRun() + text;
  }

  return {
    push(delta) {
      let out = '';
      partial += delta;
      let index;
      while ((index = partial.indexOf('\n')) >= 0) {
        const text = partial.slice(0, index + 1);
        partial = partial.slice(index + 1);
        if (streamed) { out += text.slice(streamed); streamed = 0; } else out += line(text);
      }
      if (partial && !fenceOpen && !run.length && (streamed || proseStart(partial))) { out += partial.slice(streamed); streamed = partial.length; }
      return out;
    },
    end() {
      let out = '';
      if (partial) {
        out += streamed ? partial.slice(streamed) : line(partial + '\n').replace(/\n$/, '');
        partial = ''; streamed = 0;
      }
      if (fenceOpen) {
        const {lines, char, len} = fenceOpen;
        fenceOpen = null;
        out += closeFence([...lines, `${lines.at(-1).endsWith('\n') ? '' : '\n'}${char.repeat(len)}\n`]);
      }
      return out + flushRun();
    },
    get redactions() { return redactions; }
  };
}

// Runs a whole reply through a guard (for non-streamed replies and tests).
export function guardText(text, options) {
  const guard = createOutputGuard(options);
  return {text: guard.push(String(text)) + guard.end(), redactions: guard.redactions};
}
