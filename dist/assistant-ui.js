// The AI assistant chat. In code-repo workspaces it has Ask, Plan and Agent
// modes, tool calls that wait for approval, checkpoints and saved sessions.
// Beside coding questions it is an Ask-only chat that can see your code.
import {el, api, notify, confirmDialog, store, icon} from './ui.js';
import {renderMarkdown} from './markdown.js';
import {diffView, lineDiff, diffCounts} from './diff.js';

export const MODE_INFO = {
  ask: {label: 'Ask', hint: 'Answers questions about the code. It can read files but never changes them.'},
  plan: {label: 'Plan', hint: 'Investigates the code and proposes a step-by-step plan before any change.'},
  agent: {label: 'Agent', hint: 'Edits files, runs commands and runs tests. Each change waits for your approval.'}
};
const TOOL_LABEL = {list_files: 'Listed files', read_file: 'Read file', search_code: 'Searched', view_changes: 'Viewed changes', write_file: 'Write file', edit_file: 'Edit file', delete_file: 'Delete file', run_command: 'Run command', run_tests: 'Run tests'};
const COMMANDS = [
  {name: 'explain', text: 'Explain how this works: ', description: 'Explain the open file or your selection', attach: 'selection'},
  {name: 'fix', text: 'Find the cause of the failing tests and fix it.', description: 'Fix the failing tests', attach: 'tests', mode: 'agent'},
  {name: 'tests', text: 'Write focused tests for ', description: 'Write tests', mode: 'agent'},
  {name: 'review', text: 'Review my changes for bugs, missed edge cases and style problems.', description: 'Review the current changes', attach: 'diff', mode: 'ask'},
  {name: 'plan', text: '', description: 'Switch to Plan mode', setMode: 'plan'},
  {name: 'new', text: '', description: 'Start a new session', action: 'new'}
];
const k = n => n >= 1000 ? `${Math.round(n / 100) / 10}K` : String(n);

export function createAssistant(options) {
  const {scope, variant = 'ade', modes = ['ask', 'plan', 'agent'], context = () => ({}), files = async () => [], hooks = {}, codeActions = [], suggestions = []} = options;
  const refs = {};
  let chat = null, chatId = null, models = null, busy = null, live = null, usage = null, attachments = [], popup = null;
  let mode = modes.includes(store.get(`dg-assistant-mode-${variant}`, '')) ? store.get(`dg-assistant-mode-${variant}`) : modes.includes('agent') ? 'agent' : modes[0];
  const autoApprove = () => store.get('dg-auto-approve', {edits: false, commands: false});
  const query = (extra = {}) => new URLSearchParams(Object.fromEntries(Object.entries({...scope(), ...extra}).filter(([, v]) => v !== undefined && v !== null))).toString();

  // ---------- layout ----------
  refs.title = el('strong', {class: 'chat-title', text: 'New session'});
  refs.sessionsButton = el('button', {class: 'icon-button', title: 'Sessions', 'aria-label': 'Show sessions', onclick: event => hooks.showSessions ? hooks.showSessions() : sessionsMenu(event.currentTarget)}, icon('history'));
  refs.newButton = el('button', {class: 'icon-button', title: 'New session', 'aria-label': 'New session', onclick: () => newSession()}, icon('plus'));
  refs.headExtra = el('span', {class: 'chat-head-extra'});
  refs.head = el('div', {class: 'chat-head'}, icon('spark'), refs.title, el('span', {class: 'grow'}), refs.headExtra, refs.sessionsButton, refs.newButton);
  refs.messages = el('div', {class: 'chat-log', role: 'log', 'aria-live': 'polite'});
  refs.attachments = el('div', {class: 'attach-row', hidden: true});
  refs.input = el('textarea', {rows: 2, maxlength: 12000, placeholder: variant === 'ade' ? 'Ask, plan or build. @ to add context, / for commands' : 'Ask about the problem or your code…', 'aria-label': 'Message the AI assistant'});
  refs.send = el('button', {class: 'send-button', title: 'Send (Enter)', 'aria-label': 'Send', onclick: () => busy ? stop() : send()}, icon('send'));
  refs.mode = el('button', {class: 'chip-button mode-button', title: 'Mode', onclick: event => modeMenu(event.currentTarget)});
  refs.model = el('select', {class: 'model-select', 'aria-label': 'Model', onchange: () => store.set('dg-assistant-model', refs.model.value)});
  refs.meter = el('span', {class: 'context-meter', title: 'Context window used by this session'});
  refs.attach = el('button', {class: 'icon-button', title: 'Add context (@)', 'aria-label': 'Add context', onclick: () => { insertAtCaret('@'); refs.input.focus(); onInput(); }}, '@');
  refs.status = el('div', {class: 'chat-status', hidden: true});
  const foot = el('div', {class: 'composer-foot'}, modes.length > 1 ? refs.mode : null, refs.model, refs.meter, el('span', {class: 'grow'}), refs.attach, refs.send);
  refs.composer = el('div', {class: 'chat-composer'}, refs.attachments, el('div', {class: 'composer-field'}, refs.input), foot);
  const root = el('div', {class: `assistant assistant-${variant}`}, refs.head, refs.messages, refs.status, refs.composer);

  refs.input.addEventListener('keydown', event => {
    if (popup && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) { popupKey(event); return; }
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy) send(); }
  });
  refs.input.addEventListener('input', () => { autosize(); onInput(); });
  refs.input.addEventListener('blur', () => setTimeout(closePopup, 150));
  const autosize = () => { refs.input.style.height = 'auto'; refs.input.style.height = Math.min(220, Math.max(52, refs.input.scrollHeight)) + 'px'; };

  // ---------- models, modes and the context meter ----------
  async function loadModels() {
    try {
      models = await api('/api/models');
      const preferred = store.get('dg-assistant-model', null);
      refs.model.replaceChildren(...models.models.map(m => el('option', {value: m.name, text: `${m.name}${m.parameterSize ? ` · ${m.parameterSize}` : ''}${m.tools === false && variant === 'ade' ? ' · no tools' : ''}`})));
      refs.model.value = models.models.some(m => m.name === preferred) ? preferred : models.assistant || models.models[0]?.name || '';
      if (!models.models.length) refs.model.append(el('option', {value: '', text: 'No models installed'}));
    } catch { refs.model.replaceChildren(el('option', {value: '', text: 'Ollama not running'})); }
  }
  function paintMode() {
    refs.mode.replaceChildren(icon(mode === 'agent' ? 'agent' : mode === 'plan' ? 'list' : 'chat'), MODE_INFO[mode].label, icon('caret', 'icon caret'));
    refs.mode.title = MODE_INFO[mode].hint;
    root.dataset.mode = mode;
  }
  function setMode(next) { if (!modes.includes(next)) return; mode = next; store.set(`dg-assistant-mode-${variant}`, next); paintMode(); }
  function modeMenu(anchor) {
    const auto = autoApprove();
    const items = modes.map(m => el('button', {class: `menu-item${m === mode ? ' selected' : ''}`, role: 'menuitemradio', 'aria-checked': String(m === mode), onclick: () => { setMode(m); closeMenu(); }},
      el('strong', {text: MODE_INFO[m].label}), el('small', {text: MODE_INFO[m].hint})));
    const toggle = (key, label) => el('label', {class: 'menu-check'}, el('input', {type: 'checkbox', checked: auto[key], onchange: event => store.set('dg-auto-approve', {...autoApprove(), [key]: event.target.checked})}), label);
    const extra = modes.includes('agent') ? [el('div', {class: 'menu-sep'}), el('div', {class: 'menu-label', text: 'Agent approvals'}), toggle('edits', 'Auto-approve file edits'), toggle('commands', 'Auto-approve commands and test runs')] : [];
    openMenu(anchor, [...items, ...extra], 'mode-menu');
  }
  function paintMeter() {
    const used = usage?.used || 0, limit = usage?.limit || 0;
    if (!limit) { refs.meter.hidden = true; return; }
    const share = Math.min(1, used / limit);
    refs.meter.hidden = false;
    refs.meter.replaceChildren(el('span', {class: `ring${share > 0.8 ? ' high' : share > 0.5 ? ' mid' : ''}`, style: `--p:${Math.round(share * 100)}`}), `${Math.round(share * 100)}%`);
    refs.meter.title = `Context window: about ${k(used)} of ${k(limit)} tokens used. Older tool output is trimmed automatically when it fills up.`;
  }

  // ---------- sessions ----------
  async function listSessions() { return api(`/api/assistant/chats?${query()}`); }
  async function open(id) {
    if (busy) return;
    chat = await api(`/api/assistant/chat?${query({chat: id})}`);
    chatId = chat.id;
    usage = chat.usage ? {used: chat.usage.prompt + chat.usage.completion, limit: chat.usage.limit} : null;
    if (chat.mode && modes.includes(chat.mode) && chat.items.length) setMode(chat.mode);
    render();
    hooks.onSessionChange?.(chat);
  }
  async function openLatest() {
    try { const list = await listSessions(); if (list[0]) await open(list[0].id); else newSession(false); }
    catch { newSession(false); }
  }
  function newSession(focus = true) {
    if (busy) return;
    chat = null; chatId = null; usage = null; attachments = [];
    render(); paintAttachments();
    hooks.onSessionChange?.(null);
    if (focus) refs.input.focus();
  }
  async function sessionsMenu(anchor) {
    const list = await listSessions().catch(() => []);
    openMenu(anchor, [
      el('button', {class: 'menu-item', onclick: () => { closeMenu(); newSession(); }}, icon('plus'), el('strong', {text: 'New session'})),
      el('div', {class: 'menu-sep'}),
      ...(list.length ? list.slice(0, 30).map(s => el('button', {class: `menu-item${s.id === chatId ? ' selected' : ''}`, onclick: () => { closeMenu(); open(s.id); }},
        el('strong', {text: s.title}), el('small', {text: `${ago(s.updated)} · ${s.turns} message${s.turns === 1 ? '' : 's'}${s.pending ? ' · waiting for approval' : ''}`}))) : [el('div', {class: 'menu-label', text: 'No saved sessions yet.'})])
    ], 'sessions-menu');
  }
  async function renderSessionList(container) {
    const list = await listSessions().catch(() => []);
    container.replaceChildren(
      el('button', {class: 'button small full', onclick: () => newSession()}, icon('plus'), 'New session'),
      list.length ? el('div', {class: 'session-list'}, list.map(s => el('button', {class: `session-row${s.id === chatId ? ' active' : ''}`, onclick: () => open(s.id)},
        el('span', {class: 'session-title', text: s.title}),
        el('span', {class: 'session-meta', text: `${MODE_INFO[s.mode]?.label || ''} · ${ago(s.updated)}${s.pending ? ' · approval needed' : ''}`})))) : el('p', {class: 'muted small', text: 'Your conversations with the assistant are saved here.'}));
  }

  // ---------- rendering ----------
  function render() {
    refs.title.textContent = chat?.title || 'New session';
    const nodes = [];
    if (!chat || !chat.items.length) nodes.push(emptyState());
    else for (const item of chat.items) nodes.push(itemNode(item));
    if (chat?.pending && !busy) nodes.push(pendingCard(chat.pending));
    refs.messages.replaceChildren(...nodes);
    scrollDown();
    paintMeter();
  }
  const scrollDown = () => { refs.messages.scrollTop = refs.messages.scrollHeight; };

  function emptyState() {
    const tips = suggestions.length ? suggestions : [];
    return el('div', {class: 'chat-empty'},
      el('div', {class: 'chat-empty-icon'}, icon('spark')),
      el('h3', {text: variant === 'ade' ? 'AI assistant' : 'AI assistant'}),
      el('p', {text: variant === 'ade' ? 'Ask about the codebase, plan a change, or let the agent make it. Edits and commands wait for your approval, and each message is a checkpoint you can restore.' : 'Ask about the problem, an approach, or why your code fails. It sees the problem statement and your current code.'}),
      tips.length ? el('div', {class: 'suggestions'}, tips.map(text => el('button', {class: 'suggestion', onclick: () => { refs.input.value = text; autosize(); refs.input.focus(); }}, text))) : null);
  }

  function itemNode(item) {
    if (item.type === 'user') {
      const node = el('div', {class: 'msg user'},
        item.mentions?.length ? el('div', {class: 'chips'}, item.mentions.map(m => el('span', {class: `chip ${m.type === 'error' ? 'bad' : ''}`}, icon(m.type === 'file' ? 'file' : m.type === 'diff' ? 'diff' : m.type === 'problem' ? 'book' : 'terminal'), m.label))) : null,
        el('div', {class: 'msg-text', text: item.text}),
        el('div', {class: 'msg-meta'}, modes.length > 1 ? el('span', {class: `mode-tag ${item.mode}`, text: MODE_INFO[item.mode]?.label || ''}) : null,
          item.restorable ? el('button', {class: 'link-button', title: 'Undo every file change the assistant made from this message on', onclick: () => restore(item)}, icon('restore'), 'Restore checkpoint') : null));
      return node;
    }
    if (item.type === 'assistant') return el('div', {class: 'msg assistant'}, el('div', {class: 'md'}, renderMarkdown(item.text, {language: context().language, codeActions, onCopy: hooks.onCopy})), item.stopped ? el('div', {class: 'msg-meta', text: 'Stopped'}) : null);
    if (item.type === 'tool') return toolNode(item);
    if (item.type === 'notice') return el('div', {class: 'chat-notice', text: item.text});
    if (item.type === 'error') return el('div', {class: 'chat-error'}, icon('cross'), el('span', {text: item.text}));
    return el('span');
  }

  function toolNode(item) {
    const status = {done: 'check', error: 'cross', denied: 'ban', skipped: 'ban'}[item.status] || 'check';
    const target = item.args?.path || item.args?.command || item.args?.query || '';
    const counts = item.diff ? diffCounts(lineDiff(item.diff.before ?? '', item.diff.after ?? '')) : null;
    const body = el('div', {class: 'tool-body'});
    const details = el('details', {class: `tool-row ${item.status}`},
      el('summary', {}, icon(status, `icon status ${item.status}`), el('span', {class: 'tool-name', text: TOOL_LABEL[item.name] || item.name}),
        target ? el('code', {class: 'tool-target', text: target.length > 70 ? target.slice(0, 70) + '…' : target}) : null,
        counts ? el('span', {class: 'diff-counts'}, el('span', {class: 'add', text: `+${counts.added}`}), el('span', {class: 'del', text: `−${counts.removed}`})) : null,
        item.status === 'denied' ? el('span', {class: 'tool-note', text: 'Declined'}) : item.status === 'error' ? el('span', {class: 'tool-note', text: 'Failed'}) : null));
    details.addEventListener('toggle', () => {
      if (!details.open || body.childNodes.length) return;
      if (item.diff) {
        body.append(diffView(item.diff.before, item.diff.after));
        if (hooks.openDiff && item.diff.path) body.append(el('button', {class: 'link-button', onclick: () => hooks.openDiff(item.diff.path)}, 'Open in the Diff view'));
      } else body.append(el('pre', {class: 'tool-output', text: item.output || item.summary || ''}));
    });
    details.append(body);
    return details;
  }

  function pendingCard(pending) {
    const p = pending.preview || {};
    const title = pending.name === 'run_command' ? 'Run a command' : pending.name === 'run_tests' ? 'Run the tests' : pending.name === 'delete_file' ? `Delete ${p.path}` : p.created ? `Create ${p.path}` : `Edit ${p.path}`;
    const counts = p.path ? diffCounts(lineDiff(p.before ?? '', p.after ?? '')) : null;
    const body = p.path ? diffView(p.before, p.after) : p.command ? el('pre', {class: 'tool-output command'}, el('span', {class: 'prompt', text: '$ '}), p.command) : el('p', {class: 'muted', text: pending.client ? 'The tests run in your browser, then the results go back to the agent.' : 'Runs the workspace test suite in a sandbox and returns the results to the agent.'});
    const allow = el('button', {class: 'button primary small', onclick: () => resume('allow')}, pending.name === 'run_command' || pending.name === 'run_tests' ? 'Run' : 'Allow');
    const kind = ['write_file', 'edit_file', 'delete_file'].includes(pending.name) ? 'edits' : 'commands';
    return el('div', {class: 'pending-card', role: 'group', 'aria-label': 'Pending tool call'},
      el('div', {class: 'pending-head'}, el('span', {class: 'pending-pill'}, el('span', {class: 'pulse'}), 'Pending tool call'), el('strong', {text: title}),
        counts ? el('span', {class: 'diff-counts'}, el('span', {class: 'add', text: `+${counts.added}`}), el('span', {class: 'del', text: `−${counts.removed}`})) : null),
      body,
      el('div', {class: 'pending-actions'},
        el('label', {class: 'menu-check small'}, el('input', {type: 'checkbox', onchange: event => store.set('dg-auto-approve', {...autoApprove(), [kind]: event.target.checked})}), kind === 'edits' ? 'Always allow edits' : 'Always allow commands'),
        el('span', {class: 'grow'}),
        el('button', {class: 'button ghost small', onclick: () => resume('deny')}, 'Cancel'), allow));
  }

  // ---------- streaming ----------
  function startLive() {
    const container = el('div', {class: 'live'});
    refs.messages.querySelector('.chat-empty')?.remove();
    refs.messages.querySelector('.pending-card')?.remove();
    refs.messages.append(container);
    return {container, text: '', bubble: null, md: null, frame: null, tools: new Map(), edited: false};
  }
  function paintLive() {
    live.frame = null;
    if (!live.bubble) {
      live.md = el('div', {class: 'md'});
      live.bubble = el('div', {class: 'msg assistant streaming'}, live.md);
      live.container.append(live.bubble);
    }
    live.md.replaceChildren(renderMarkdown(live.text.replace(/<tool_call>[\s\S]*$/, ''), {language: context().language, codeActions}));
    scrollDown();
  }
  function onEvent(event) {
    if (!live) return;
    if (event.type === 'start') {
      if (!chatId) { chatId = event.chat; hooks.onSessionsChanged?.(); }
    } else if (event.type === 'user') {
      live.container.append(itemNode(event.item));
      thinking(true);
    } else if (event.type === 'context') { usage = {used: event.used, limit: event.limit}; paintMeter(); }
    else if (event.type === 'usage') { usage = {used: event.prompt + event.completion, limit: event.limit}; paintMeter(); }
    else if (event.type === 'delta') {
      thinking(false);
      live.text += event.text;
      if (!live.frame) live.frame = requestAnimationFrame(paintLive);
    } else if (event.type === 'step') {
      if (live.frame) { cancelAnimationFrame(live.frame); paintLive(); }
      live.text = ''; live.bubble = null;
      thinking(true);
    } else if (event.type === 'tool') {
      thinking(event.status === 'running');
      const label = TOOL_LABEL[event.name] || event.name;
      if (event.status === 'running') {
        const row = el('div', {class: 'tool-row live-tool'}, el('span', {class: 'spinner'}), el('span', {class: 'tool-name', text: label}), event.args?.path || event.args?.query ? el('code', {class: 'tool-target', text: event.args.path || event.args.query}) : null);
        live.tools.set(event.name, row);
        live.container.append(row);
      } else {
        const row = live.tools.get(event.name) || el('div', {class: 'tool-row live-tool'});
        live.tools.delete(event.name);
        row.replaceChildren(icon(event.status === 'done' ? 'check' : event.status === 'denied' ? 'ban' : 'cross', `icon status ${event.status}`), el('span', {class: 'tool-name', text: event.summary || label}));
        if (!row.isConnected) live.container.append(row);
        if (['write_file', 'edit_file', 'delete_file'].includes(event.name) && event.status === 'done') { live.edited = true; hooks.onFilesChanged?.(); }
        if (event.name === 'run_tests' || event.name === 'run_command') hooks.onToolOutput?.(event);
      }
      scrollDown();
    } else if (event.type === 'progress') {
      refs.status.hidden = false;
      refs.status.replaceChildren(el('span', {class: 'spinner'}), event.text);
    }
  }
  function thinking(on) {
    live.container.querySelector('.thinking')?.remove();
    if (on) live.container.append(el('div', {class: 'thinking'}, el('span', {class: 'dots'}, el('i'), el('i'), el('i')), mode === 'agent' ? 'Working…' : 'Thinking…'));
    scrollDown();
  }

  async function runStream(url, body) {
    const controller = new AbortController();
    busy = {controller};
    paintComposer();
    live = startLive();
    let final = null, failure = null;
    try {
      const response = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: controller.signal});
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'The assistant is unavailable.'); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          onEvent(event);
          if (event.type === 'done') final = event;
          if (event.type === 'error') failure = event.message;
        }
      }
    } catch (error) { if (!controller.signal.aborted) failure = error.message; }
    const edited = live?.edited;
    busy = null; live = null;
    refs.status.hidden = true;
    if (final?.chat) { chat = final.chat; chatId = chat.id; }
    else if (chatId) { try { chat = await api(`/api/assistant/chat?${query({chat: chatId})}`); } catch {} }
    if (chat?.usage) usage = {used: chat.usage.prompt + chat.usage.completion, limit: chat.usage.limit};
    render();
    paintComposer();
    if (failure && !chat?.items.some(i => i.type === 'error' && i.text === failure)) refs.messages.append(el('div', {class: 'chat-error'}, icon('cross'), el('span', {text: failure})));
    scrollDown();
    if (edited) hooks.onFilesChanged?.();
    hooks.onSessionsChanged?.();
    hooks.onTurnEnd?.(chat);
    // Client-side tools (browser test runs) start right after approval.
    return final;
  }

  async function send(text = refs.input.value.trim()) {
    if (busy || !text) return;
    if (chat?.pending) { notify('Approve or cancel the pending action first.', 'error'); return; }
    if (!refs.model.value) { notify('No local model is available. Start Ollama and download a chat model.', 'error'); return; }
    await hooks.beforeSend?.();
    const mentions = attachments.map(({type, path, text: body}) => ({type, path, text: body}));
    refs.input.value = '';
    autosize();
    attachments = [];
    paintAttachments();
    await runStream('/api/assistant/send', {...scope(), ...context(), chat: chatId, mode, model: refs.model.value, message: text, mentions, autoApprove: autoApprove()});
  }

  async function resume(decision) {
    if (busy || !chat?.pending) return;
    const pending = chat.pending;
    let result;
    if (decision === 'allow' && pending.client) {
      try { result = await hooks.runClientTool?.(pending.client); }
      catch (error) { result = `The test run failed to start: ${error.message}`; }
    }
    await runStream('/api/assistant/resume', {...scope(), ...context(), chat: chatId, decision, result, model: refs.model.value, autoApprove: autoApprove()});
  }

  function stop() { busy?.controller.abort(); }

  async function restore(item) {
    const ok = await confirmDialog({title: 'Restore this checkpoint?', body: 'Every file change the assistant made from this message on is undone, and the conversation goes back to just before it. Your message returns to the input box so you can edit it.', confirm: 'Restore', cancel: 'Cancel'});
    if (!ok) return;
    try {
      const result = await api('/api/assistant/restore', {...scope(), chat: chatId, item: item.id});
      chat = result.chat;
      render();
      refs.input.value = result.text;
      autosize();
      refs.input.focus();
      hooks.onFilesChanged?.();
      if (result.restored.length) notify(`Restored ${result.restored.join(', ')}.`, 'success');
    } catch (error) { notify(error.message, 'error'); }
  }

  function paintComposer() {
    refs.send.replaceChildren(icon(busy ? 'stop' : 'send'));
    refs.send.title = busy ? 'Stop' : 'Send (Enter)';
    refs.send.classList.toggle('stop', !!busy);
    root.classList.toggle('busy', !!busy);
  }

  // ---------- @ mentions and / commands ----------
  function insertAtCaret(text) {
    const {selectionStart: s, selectionEnd: e, value} = refs.input;
    refs.input.value = value.slice(0, s) + text + value.slice(e);
    refs.input.selectionStart = refs.input.selectionEnd = s + text.length;
  }
  async function mentionOptions(q) {
    const specials = [{type: 'problem', label: 'Problem statement', detail: 'The task description'}];
    if (variant === 'ade') specials.push({type: 'diff', label: 'Changes', detail: 'Everything changed so far'});
    const terminal = hooks.terminalText?.(), tests = hooks.testsText?.(), selection = hooks.selection?.();
    if (terminal) specials.push({type: 'terminal', label: 'Terminal output', detail: 'The latest command output', text: terminal});
    if (tests) specials.push({type: 'tests', label: 'Test results', detail: 'The latest test run', text: tests});
    if (selection?.text) specials.push({type: 'selection', label: 'Selection', detail: `${selection.path || 'Editor'} · ${selection.text.split('\n').length} lines`, text: selection.text, path: selection.path});
    const needle = q.toLowerCase();
    const list = specials.filter(s => !needle || s.label.toLowerCase().includes(needle));
    if (variant === 'ade') {
      const all = await files();
      const scored = all.map(path => {
        const lower = path.toLowerCase(), base = lower.split('/').pop();
        const score = !needle ? 1 : base.startsWith(needle) ? 3 : base.includes(needle) ? 2 : lower.includes(needle) ? 1 : 0;
        return {path, score};
      }).filter(x => x.score).sort((a, b) => b.score - a.score || a.path.length - b.path.length).slice(0, 40);
      list.push(...scored.map(({path}) => ({type: 'file', path, label: path.split('/').pop(), detail: path})));
    }
    return list;
  }
  async function onInput() {
    const before = refs.input.value.slice(0, refs.input.selectionStart);
    const mention = /(^|\s)@([\w./-]*)$/.exec(before);
    const command = /^\/(\w*)$/.exec(before);
    if (mention) {
      const options = await mentionOptions(mention[2]);
      showPopup(options.map(o => ({...o, icon: o.type === 'file' ? 'file' : o.type === 'diff' ? 'diff' : o.type === 'problem' ? 'book' : 'terminal'})), option => {
        refs.input.value = before.slice(0, before.length - mention[2].length - 1) + refs.input.value.slice(refs.input.selectionStart);
        addAttachment(option);
      });
    } else if (command) {
      const options = COMMANDS.filter(c => c.name.startsWith(command[1].toLowerCase()) && (!c.mode || modes.includes(c.mode)) && (!c.setMode || modes.includes(c.setMode))).map(c => ({...c, label: `/${c.name}`, detail: c.description, icon: 'slash'}));
      showPopup(options, option => runCommand(option));
    } else closePopup();
  }
  function runCommand(cmd) {
    refs.input.value = '';
    if (cmd.action === 'new') { newSession(); return; }
    if (cmd.setMode) { setMode(cmd.setMode); notify(`${MODE_INFO[cmd.setMode].label} mode`); return; }
    if (cmd.mode) setMode(cmd.mode);
    if (cmd.attach === 'tests' && hooks.testsText?.()) addAttachment({type: 'tests', label: 'Test results', text: hooks.testsText()});
    if (cmd.attach === 'diff' && variant === 'ade') addAttachment({type: 'diff', label: 'Changes'});
    if (cmd.attach === 'selection') {
      const selection = hooks.selection?.();
      if (selection?.text) addAttachment({type: 'selection', label: 'Selection', text: selection.text, path: selection.path});
      else if (hooks.openFile?.()) addAttachment({type: 'file', path: hooks.openFile(), label: hooks.openFile().split('/').pop()});
    }
    refs.input.value = cmd.text;
    autosize();
    refs.input.focus();
  }
  function addAttachment(option) {
    const key = `${option.type}:${option.path || ''}`;
    if (!attachments.some(a => `${a.type}:${a.path || ''}` === key)) attachments.push({type: option.type, path: option.path, label: option.label === 'Selection' && option.path ? `Selection · ${option.path.split('/').pop()}` : option.type === 'file' ? option.path : option.label, text: option.text});
    paintAttachments();
    autosize();
    refs.input.focus();
  }
  function paintAttachments() {
    refs.attachments.hidden = !attachments.length;
    refs.attachments.replaceChildren(...attachments.map((a, i) => el('span', {class: 'chip removable'}, icon(a.type === 'file' ? 'file' : a.type === 'diff' ? 'diff' : a.type === 'problem' ? 'book' : 'terminal'), a.label,
      el('button', {class: 'chip-x', 'aria-label': `Remove ${a.label}`, onclick: () => { attachments.splice(i, 1); paintAttachments(); }}, '×'))));
  }
  function showPopup(options, pick) {
    closePopup();
    if (!options.length) return;
    let index = 0;
    const list = el('div', {class: 'mention-popup', role: 'listbox'});
    const paint = () => list.replaceChildren(...options.map((o, i) => el('button', {class: `mention-item${i === index ? ' active' : ''}`, role: 'option', 'aria-selected': String(i === index), onmousedown: event => { event.preventDefault(); closePopup(); pick(o); }},
      icon(o.icon || 'file'), el('span', {class: 'mention-label', text: o.label}), el('span', {class: 'mention-detail', text: o.detail || ''}))));
    paint();
    refs.composer.append(list);
    popup = {list, options, pick, move: delta => { index = (index + delta + options.length) % options.length; paint(); list.children[index]?.scrollIntoView({block: 'nearest'}); }, current: () => options[index]};
  }
  function popupKey(event) {
    event.preventDefault();
    if (event.key === 'Escape') return closePopup();
    if (event.key === 'ArrowDown') return popup.move(1);
    if (event.key === 'ArrowUp') return popup.move(-1);
    const {pick, current} = popup;
    const option = current();
    closePopup();
    pick(option);
  }
  function closePopup() { popup?.list.remove(); popup = null; }

  // ---------- small menus ----------
  let menu = null;
  function openMenu(anchor, children, className) {
    closeMenu();
    const rect = anchor.getBoundingClientRect();
    menu = el('div', {class: `menu floating ${className}`, role: 'menu'}, children);
    document.body.append(menu);
    const height = menu.offsetHeight, width = menu.offsetWidth;
    const top = rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left))}px`;
    setTimeout(() => document.addEventListener('pointerdown', away), 0);
  }
  function away(event) { if (menu && !menu.contains(event.target)) closeMenu(); }
  function closeMenu() { menu?.remove(); menu = null; document.removeEventListener('pointerdown', away); }

  paintMode();
  paintComposer();
  render();
  loadModels();

  return {
    root, open, openLatest, newSession, send, stop, setMode, renderSessionList, listSessions, addAttachment,
    setHeaderExtra: (...nodes) => refs.headExtra.replaceChildren(...nodes),
    ask(text, {submit = false} = {}) { refs.input.value = text; autosize(); refs.input.focus(); if (submit) send(); },
    focus: () => refs.input.focus(),
    get chatId() { return chatId; },
    get busy() { return !!busy; },
    get mode() { return mode; }
  };
}

export function ago(at) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(at).toLocaleDateString();
}
