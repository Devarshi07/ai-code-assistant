// One set of Ollama settings for every AI call in the app. Ollama reloads a
// model whenever a request asks for a different context size, which costs
// seconds, so every request for a model uses the same num_ctx and keep_alive,
// and the models are loaded before the first message instead of during it.
export const KEEP_ALIVE = '30m';
export const COMPLETION_CTX = 4096;
export const COMPLETION_PREFERENCE = ['qwen2.5-coder:3b', 'qwen2.5-coder:1.5b', 'qwen2.5-coder:7b', 'qwen2.5-coder:0.5b'];

export const billions = (size = '') => { const m = /([\d.]+)\s*([BM])/i.exec(size); return m ? (m[2].toUpperCase() === 'B' ? +m[1] : +m[1] / 1000) : 0; };

export function contextFor(model) {
  return Number(process.env.DG_ASSISTANT_CTX) || (billions(model?.parameterSize) >= 6 ? 16384 : 8192);
}

// The body of an /api/chat request.
export function chatRequest(model, {messages, stream = true, tools, format, temperature = 0.2, numPredict} = {}) {
  // Qwen3 without thinking loops on one sentence at low temperature; its
  // recommended non-thinking sampling (0.7 / top-p 0.8 / top-k 20) plus a small
  // presence penalty avoids that. JSON-format calls keep the caller's setting.
  const qwen3 = /qwen3/i.test(model.name) && !format;
  const sampling = qwen3 ? {temperature: Math.max(temperature, 0.6), top_p: 0.8, top_k: 20, presence_penalty: 0.5} : {temperature};
  return {
    model: model.name, messages, stream, keep_alive: KEEP_ALIVE,
    ...(tools?.length ? {tools} : {}), ...(model.thinking ? {think: false} : {}), ...(format ? {format} : {}),
    options: {num_ctx: contextFor(model), ...sampling, repeat_penalty: 1.05, ...(numPredict ? {num_predict: numPredict} : {})}
  };
}

// Where a looping reply should be cut: the start of the second copy of a
// sentence that has already appeared five times in the last few thousand
// characters. -1 when the text is not looping.
export function repetitionCut(text) {
  const tail = String(text).slice(-4000);
  const counts = new Map();
  for (const raw of tail.split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.trim();
    if (sentence.length < 25 || !/[a-z]{3,}\s+[a-z]{2,}/i.test(sentence)) continue;
    const n = (counts.get(sentence) || 0) + 1;
    counts.set(sentence, n);
    if (n >= 5) {
      const first = text.indexOf(sentence);
      const second = text.indexOf(sentence, first + sentence.length);
      return second > first ? second : -1;
    }
  }
  return -1;
}

export function pickCompletionModel(available) {
  const fim = available.models.filter(m => m.insert);
  return fim.find(m => m.name === process.env.DG_COMPLETION_MODEL) || COMPLETION_PREFERENCE.map(name => fim.find(m => m.name === name)).find(Boolean) || fim[0] || null;
}

const warmed = new Map();
// Loads a model with the app's settings. Repeated calls within a minute are free.
export async function warm(OLLAMA, model, {completion = false} = {}) {
  if (!model) return false;
  if (Date.now() - (warmed.get(model.name) || 0) < 60000) return true;
  warmed.set(model.name, Date.now());
  const body = completion
    ? {model: model.name, prompt: '', keep_alive: KEEP_ALIVE, options: {num_ctx: COMPLETION_CTX}}
    : {model: model.name, messages: [], keep_alive: KEEP_ALIVE, options: {num_ctx: contextFor(model)}};
  try {
    const response = await fetch(OLLAMA + (completion ? '/api/generate' : '/api/chat'), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(180000)});
    await response.text();
    if (!response.ok) throw new Error('load failed');
    return true;
  } catch { warmed.delete(model.name); return false; }
}

// Loads the assistant model and, when wanted, the inline-suggestion model.
export async function warmModels(OLLAMA, models, {completion = true} = {}) {
  try {
    const available = await models();
    await warm(OLLAMA, available.models.find(m => m.name === available.assistant));
    if (completion) await warm(OLLAMA, pickCompletionModel(available), {completion: true});
  } catch {}
}
