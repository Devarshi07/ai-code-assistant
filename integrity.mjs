// The end-of-test integrity review and AI-usage grades. Pure functions over
// what the test recorded, so the same evidence always gives the same result.
//
// Integrity: every recorded signal becomes a flag with a weight, and the total
// gives a Low, Medium or High risk rating, like the suspicion scores
// assessment platforms show reviewers. AI usage: each prompt is labelled with
// the kind of help it asked for, and three areas are graded A, B or C (NA when
// the assistant wasn't used).

const LONG_AWAY_MS = 30000;
const LARGE_PASTE = 200;
export const RISK_LEVELS = [{max: 4, level: 'Low'}, {max: 11, level: 'Medium'}, {max: Infinity, level: 'High'}];

const cap = (n, max) => Math.min(n, max);
const secs = ms => `${Math.round(ms / 1000)} s`;

// events: the test's integrity events; settings: {integrity, ai}; ai: the AI-usage summary.
export function assessIntegrity(events = [], {settings = {}, ai = null, started = 0} = {}) {
  const flags = [];
  const add = (kind, weight, text, at = null, question = null) => flags.push({kind, weight, text, at, question});
  const of = type => events.filter(e => e.type === type);
  const minute = at => at && started ? `minute ${Math.max(0, Math.floor((at - started) / 60000))}` : '';

  const tabs = of('tab');
  const awayMs = tabs.reduce((sum, e) => sum + (e.ms || 0), 0);
  const long = tabs.filter(e => (e.ms || 0) >= LONG_AWAY_MS);
  if (tabs.length) add('tab', cap(tabs.length, 6), `Left the test window ${tabs.length} time${tabs.length === 1 ? '' : 's'} (${secs(awayMs)} in total).`);
  for (const e of long.slice(0, 3)) add('long-away', 2, `Away from the test for ${secs(e.ms)} at ${minute(e.at)}.`, e.at, e.question);
  if (awayMs >= 120000) add('away-total', 3, `More than two minutes away from the test in total.`);
  const fullscreen = of('fullscreen');
  if (fullscreen.length && settings.integrity !== 'standard') add('fullscreen', cap(fullscreen.length * 2, 6), `Left full screen ${fullscreen.length} time${fullscreen.length === 1 ? '' : 's'}.`);

  for (const e of of('paste')) {
    const large = (e.chars || 0) >= LARGE_PASTE;
    add(large ? 'large-paste' : 'paste', large ? 3 : 1, `${large ? 'Pasted a large block' : 'Pasted text'} from outside the test (${e.chars || '?'} characters) at ${minute(e.at)}.`, e.at, e.question);
  }
  const blocked = of('blocked-paste');
  if (blocked.length) add('blocked-paste', cap(blocked.length, 3), `Tried to paste from outside the test ${blocked.length} time${blocked.length === 1 ? '' : 's'} (blocked).`);
  for (const e of of('code-reset')) add('code-reset', 4, `Deleted most of the code, then a large block appeared at once (${e.chars || '?'} characters) at ${minute(e.at)}.`, e.at, e.question);
  if (of('typing-anomaly').length) add('typing-anomaly', 3, `Typing faster than a person can for a sustained stretch (${of('typing-anomaly')[0].rate || '?'} characters a second).`, of('typing-anomaly')[0].at, of('typing-anomaly')[0].question);
  for (const e of of('no-face').slice(0, 4)) add('no-face', 2, `No face in the webcam for ${secs(e.ms || 0)} at ${minute(e.at)}.`, e.at);
  for (const e of of('multi-face').slice(0, 3)) add('multi-face', 4, `More than one face in the webcam at ${minute(e.at)}.`, e.at);

  if (ai) {
    if (ai.ruleChanges) add('ai-rules', cap(ai.ruleChanges * 3, 6), `Asked the AI to ignore or change its rules ${ai.ruleChanges} time${ai.ruleChanges === 1 ? '' : 's'}.`);
    if (ai.solutionRequests && settings.ai === 'guarded') add('ai-solution', cap(ai.solutionRequests, 3), `Asked the guarded AI for a full solution ${ai.solutionRequests} time${ai.solutionRequests === 1 ? '' : 's'}.`);
    if (ai.redactions) add('ai-redacted', cap(ai.redactions, 3), `The guardrail hid ${ai.redactions} code block${ai.redactions === 1 ? '' : 's'} from the AI's replies.`);
  }

  const score = flags.reduce((sum, f) => sum + f.weight, 0);
  const level = RISK_LEVELS.find(r => score <= r.max).level;
  return {risk: level, score, flags: flags.sort((a, b) => b.weight - a.weight), awayMs};
}

// What kind of help a prompt asks for. Order matters: the first match wins.
const HELP_TYPES = [
  ['solution', /\b(full|complete|entire|whole|working|final)\s+(solution|code|program|implementation)\b|\b(write|give|show)\s+(me\s+)?(the\s+)?(code|solution)\b|\bsolve\s+(it|this)\b/i],
  ['debugging', /\b(error|exception|traceback|fails?|failing|wrong answer|bug|crash|doesn'?t work|not working|why does|why is|timeout|time limit|runtime)\b/i],
  ['syntax', /\b(syntax|how (do|to) (i )?(write|declare|use|read|parse|print|sort|split|loop)|what does .* mean|function to|built-?in|library|method for)\b/i],
  ['approach', /\b(approach|algorithm|complexity|o\(|optimi[sz]e|faster|data structure|idea|strategy|edge cases?|hint)\b/i],
  ['concept', /\b(what is|explain|understand|difference between|why|how does)\b/i]
];
export function helpType(text) {
  for (const [type, pattern] of HELP_TYPES) if (pattern.test(text)) return type;
  return 'other';
}

const VAGUE = /^\s*(help|hi|hello|solve( it| this)?|answer|code|what\??|\?+|do it|continue|ok)\s*[.!?]*\s*$/i;
const PUSHBACK = /\b(but|wrong|incorrect|doesn'?t|isn'?t|are you sure|that fails|still fails|not right|why not|instead|actually)\b/i;

// chats: [{question, items: [...]}] from the test's assistant folders;
// events: integrity events (for AI inserts and runs); vocabulary: per question,
// identifiers from the statement and template that show a prompt is specific.
export function assessAiUsage(chats = [], events = [], vocabulary = {}) {
  const prompts = [];
  let redactions = 0;
  for (const chat of chats) for (const item of chat.items || []) {
    if (item.type === 'user') prompts.push({question: chat.question, text: String(item.text || ''), at: item.at || 0, flags: item.flags || []});
    if (item.type === 'assistant' && item.redacted) redactions += item.redacted;
  }
  const solutionRequests = prompts.filter(p => p.flags.includes('solution-request')).length;
  const ruleChanges = prompts.filter(p => p.flags.includes('rule-change')).length;
  if (!prompts.length) return {used: false, prompts: 0, grades: {context: 'NA', critical: 'NA', collaboration: 'NA'}, helpTypes: {}, examples: [], solutionRequests, ruleChanges, redactions};

  const helpTypes = {};
  for (const p of prompts) { p.type = helpType(p.text); helpTypes[p.type] = (helpTypes[p.type] || 0) + 1; }
  const specific = p => {
    if (VAGUE.test(p.text) || p.text.length < 12) return false;
    const words = new Set((p.text.toLowerCase().match(/[a-z_][a-z0-9_]{2,}/g) || []));
    const vocab = vocabulary[p.question] || [];
    return vocab.some(v => words.has(v.toLowerCase())) || /line \d+|`[^`]+`|\b(my|this) (code|loop|function|output|approach)\b|error|expected|test case/i.test(p.text);
  };
  const specificShare = prompts.filter(specific).length / prompts.length;
  const inserts = events.filter(e => e.type === 'ai-insert');
  const runs = events.filter(e => e.type === 'run' || e.type === 'tests');
  const verified = inserts.filter(i => runs.some(r => r.at > i.at && r.at - i.at < 10 * 60000 && (!i.question || r.question === i.question))).length;
  const pushback = prompts.filter(p => PUSHBACK.test(p.text)).length;
  const solutionShare = (helpTypes.solution || 0) / prompts.length;

  const grade = (score, a, b) => score >= a ? 'A' : score >= b ? 'B' : 'C';
  const context = grade(specificShare, 0.6, 0.3);
  const criticalScore = (inserts.length ? verified / inserts.length : 0.5) * 0.6 + Math.min(1, pushback / 2) * 0.4 - (ruleChanges ? 0.3 : 0);
  const critical = grade(criticalScore, 0.6, 0.3);
  const perQuestion = new Map();
  for (const p of prompts) perQuestion.set(p.question, (perQuestion.get(p.question) || 0) + 1);
  const iterative = [...perQuestion.values()].some(n => n >= 2);
  const collaborationScore = (iterative ? 0.5 : 0.2) + (1 - solutionShare) * 0.5 - Math.min(0.4, ruleChanges * 0.2 + solutionRequests * 0.05);
  const collaboration = grade(collaborationScore, 0.75, 0.45);
  const examples = [...prompts].sort((a, b) => Number(specific(b)) - Number(specific(a)) || b.text.length - a.text.length).slice(0, 3).map(p => ({text: p.text.slice(0, 220), type: p.type, specific: specific(p)}));
  return {used: true, prompts: prompts.length, grades: {context, critical, collaboration}, helpTypes, examples, specificShare: Math.round(specificShare * 100), inserts: inserts.length, verified, pushback, solutionRequests, ruleChanges, redactions};
}
