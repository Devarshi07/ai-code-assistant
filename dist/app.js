// The app shell: navigation, routing, local setup, the home page, your
// activity and the guide. Each area lives in its own module.
import {$, el, api, waitJob, notify, store, icon, icons, DIFFICULTY_CLASS, VERDICT_CLASS} from './ui.js';
import {renderMarkdown} from './markdown.js';

const views = ['home', 'questions', 'repos', 'mock', 'activity', 'guide', 'feedback', 'open', 'mockreport', 'tests', 'testpage', 'prep'];
const fullscreens = ['coding-ide', 'ade', 'mock-room', 'test-room'];
let status = null;
const modules = {};
const load = name => modules[name] ||= import(`./${name}.js`);

export function getStatus() { return status; }

// ---------- updates ----------
// Stylesheets load once per page while scripts load on demand, so a tab left
// open across an update can mix old styles with new code. When the server's
// files change, a banner offers a reload (open work is saved first), and the
// next move to a page with nothing to lose (lists and lobbies) reloads by
// itself. A check never reloads a page on its own.
let loadedVersion = null, versionChecked = 0, updateReady = false;
const SAFE_PAGES = /^#\/(home|questions|repos(\/[\w-]+)?|activity|guide|tests|prep(\/[\w-]+)?)?$/;
async function checkVersion() {
  if (updateReady || Date.now() - versionChecked < 5000) return;
  versionChecked = Date.now();
  let version;
  try { version = (await api('/api/version')).version; } catch { return; }
  if (!loadedVersion) { loadedVersion = version; return; }
  if (version === loadedVersion || updateReady) return;
  updateReady = true;
  const banner = el('div', {class: 'update-banner', role: 'status'}, icon('refresh'), el('span', {text: 'Debug Gym was updated. Reload to use the new version; open work is saved first.'}),
    el('button', {class: 'button primary small', onclick: () => reloadForUpdate()}, 'Reload'),
    el('button', {class: 'icon-button', 'aria-label': 'Dismiss', onclick: () => banner.remove()}, '×'));
  document.body.append(banner);
}
async function reloadForUpdate() {
  // Closing the workspace or editor saves open files before the page goes away.
  try { await closeFullscreens(); } catch {}
  location.reload();
}

// ---------- shell ----------
function show(name) {
  for (const view of views) $(`view-${view}`).hidden = view !== name;
  document.body.dataset.view = name;
  $('sidebar').classList.remove('open');
  $('sidebarToggle').setAttribute('aria-expanded', 'false');
}
function setNav(key) {
  for (const link of document.querySelectorAll('.nav-link')) link.classList.toggle('active', link.dataset.nav === key);
}
async function closeFullscreens(except) {
  for (const id of fullscreens) {
    if (id === except || $(id).hidden) continue;
    const module = {'coding-ide': 'coding', ade: 'ade', 'mock-room': 'mock', 'test-room': 'tests'}[id];
    try { const m = await load(module); await m.closeFullscreen?.(); } catch {}
    $(id).hidden = true;
  }
  document.body.classList.toggle('fs-open', fullscreens.some(id => !$(id).hidden));
}
export function enterFullscreen(id) {
  for (const other of fullscreens) if (other !== id) $(other).hidden = true;
  $(id).hidden = false;
  document.body.classList.add('fs-open');
}

const REDIRECTS = {'#/ai-coding': '#/repos/guided', '#/ai-coding/open-ended': '#/repos/open-ended', '#/history': '#/activity', '#/': '#/home', '': '#/home'};

async function route() {
  let hash = location.hash || '#/home';
  if (REDIRECTS[hash] !== undefined) { location.replace(REDIRECTS[hash]); return; }
  const parts = hash.slice(2).split('/');
  if (parts[0] === 'practice' && parts[1]) { location.replace(`#/ade/practice/${parts[1]}`); return; }
  if (parts[0] === 'repo' && parts[1]) { location.replace(`#/ade/repo/${parts[1]}`); return; }
  // A local request, throttled to one every few seconds.
  await checkVersion();
  if (updateReady && SAFE_PAGES.test(hash)) { await reloadForUpdate(); return; }
  document.querySelector('.menu.floating')?.remove();
  const [section, a, b, c, d] = parts;
  if ($('setup').open) $('setup').close();
  delete document.body.dataset.focus;
  try {
    if (section === 'question' && a) {
      await closeFullscreens('coding-ide');
      setNav('questions');
      await (await load('coding')).openQuestion($('coding-ide'), a);
      return;
    }
    if (section === 'ade' && a && b) {
      await closeFullscreens('ade');
      setNav(c === 'mock' ? 'mock' : 'repos');
      await (await load('ade')).openAde($('ade'), a, b, {mock: c === 'mock' ? d : null});
      return;
    }
    if (section === 'mock' && a) {
      await closeFullscreens('mock-room');
      setNav('mock');
      await (await load('mock')).openRoom($('mock-room'), a);
      return;
    }
    if (section === 'test' && a && b === 'room') {
      await closeFullscreens('test-room');
      setNav('tests');
      await (await load('tests')).openTestRoom($('test-room'), a);
      return;
    }
    await closeFullscreens();
    if (section === 'tests') { show('tests'); setNav('tests'); document.title = 'Practice tests · Debug Gym'; await (await load('tests')).renderTestsLobby($('view-tests')); return; }
    if (section === 'test' && a) { show('testpage'); setNav('tests'); document.title = 'Practice test · Debug Gym'; await (await load('tests')).renderTestPage($('view-testpage'), a); return; }
    if (section === 'questions') { show('questions'); setNav('questions'); document.title = 'Coding questions · Debug Gym'; await (await load('coding')).renderLibrary($('view-questions')); }
    else if (section === 'repos') { show('repos'); setNav('repos'); document.title = 'Code repos · Debug Gym'; await (await load('repos')).renderRepos($('view-repos'), a || 'guided'); }
    else if (section === 'feedback' && a) { show('feedback'); setNav('activity'); document.title = 'Feedback · Debug Gym'; await (await load('repos')).renderFeedback($('view-feedback'), a); }
    else if (section === 'open' && a) { show('open'); setNav('repos'); document.title = 'Open-ended session · Debug Gym'; await (await load('open-ended')).renderOpenSession($('view-open'), a, {loadStatus}); }
    else if (section === 'mock') { show('mock'); setNav('mock'); document.title = 'Mock interviews · Debug Gym'; await (await load('mock')).renderMockLobby($('view-mock')); }
    else if (section === 'mockreport' && a) { show('mockreport'); setNav('mock'); document.title = 'Interview feedback · Debug Gym'; await (await load('mock')).renderReport($('view-mockreport'), a); }
    else if (section === 'activity') { show('activity'); setNav('activity'); document.title = 'Your activity · Debug Gym'; await renderActivity(); }
    else if (section === 'guide') { show('guide'); setNav('guide'); document.title = 'How it works · Debug Gym'; renderGuide(); }
    else if (section === 'prep') { show('prep'); setNav('prep'); document.title = 'Prep guides · Debug Gym'; await (a ? renderPrepGuide(a) : renderPrep()); }
    else { show('home'); setNav('home'); document.title = 'Debug Gym · AI-assisted coding practice'; await renderHome(); }
  } catch (error) {
    notify(error.message, 'error');
    if (section === 'question') location.hash = '#/questions';
    else if (section === 'ade') location.hash = '#/repos';
    else if (section === 'mock' && a) location.hash = '#/mock';
    else if (section === 'test') location.hash = '#/tests';
  }
}

function initShell() {
  for (const node of document.querySelectorAll('.nav-icon')) node.innerHTML = icons[node.dataset.icon] || '';
  $('sidebarToggle').onclick = () => {
    const open = !$('sidebar').classList.contains('open');
    $('sidebar').classList.toggle('open', open);
    $('sidebarToggle').setAttribute('aria-expanded', String(open));
  };
  const theme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const paint = () => { $('themeToggle').innerHTML = theme() === 'dark' ? icons.sun : icons.moon; };
  $('themeToggle').onclick = () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('dg-theme', next);
    paint();
    window.dispatchEvent(new Event('dg-editor-settings'));
  };
  paint();
  $('setupButton').addEventListener('click', () => { $('setup').showModal(); renderSetup(); });
  $('closeSetup').onclick = () => $('setup').close();
  $('refreshStatus').onclick = () => renderSetup();
  const pull = model => async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await api('/api/model/pull', {model});
      await waitJob(result, text => { $('setupStatus').textContent = text; });
      $('setupStatus').textContent = `${model} is ready.`;
      await renderSetup();
    } catch (error) { $('setupStatus').textContent = error.message; }
    finally { button.disabled = false; }
  };
  $('pullChat').onclick = pull('qwen3:8b');
  $('pullCoder').onclick = pull('qwen2.5-coder:3b');
  window.addEventListener('hashchange', route);
  setInterval(checkVersion, 60000);
  // Escape closes any open pop-up menu.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menu = document.querySelector('.menu.floating');
    if (menu) { menu.remove(); event.stopPropagation(); }
  });
}

// The theme toggle, for full-screen views that hide the app's top bar.
export function themeButton() {
  const current = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const button = el('button', {class: 'icon-button theme-switch', title: 'Switch colour theme', 'aria-label': 'Switch colour theme'});
  const paint = () => { button.innerHTML = current() === 'dark' ? icons.sun : icons.moon; };
  button.onclick = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('dg-theme', next);
    paint();
    $('themeToggle').innerHTML = next === 'dark' ? icons.sun : icons.moon;
    window.dispatchEvent(new Event('dg-editor-settings'));
  };
  paint();
  return button;
}

export async function loadStatus() {
  const [base, models] = await Promise.allSettled([api('/api/status'), api('/api/models')]);
  status = {
    docker: base.status === 'fulfilled' && base.value.docker,
    ollama: base.status === 'fulfilled' && base.value.ollama,
    models: models.status === 'fulfilled' ? models.value : {models: [], assistant: null, reviewer: null}
  };
  const health = $('health');
  const ready = status.ollama && status.models.models.length;
  health.textContent = ready ? '●' : '○';
  health.className = `health ${ready && status.docker ? 'ok' : ready ? 'partial' : ''}`;
  health.title = ready ? (status.docker ? 'AI and Docker ready' : 'AI ready · Docker not running') : 'Ollama not running or no models';
  return status;
}

async function renderSetup() {
  const box = $('setupModels');
  box.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Checking local services…'));
  const s = await loadStatus();
  const fim = s.models.models.find(m => m.insert);
  const row = (label, ok, detail) => el('div', {class: 'row'}, el('span', {text: label}), el('span', {class: ok ? 'ok' : 'bad', text: detail}));
  box.replaceChildren(
    row('Ollama', s.ollama, s.ollama ? 'Running' : 'Not running'),
    row('Assistant, agent and interviewer', !!s.models.assistant, s.models.assistant || 'No chat model installed'),
    row('Feedback reviewer', !!s.models.reviewer, s.models.reviewer || 'None. Feedback uses rule-based scores only'),
    row('Inline suggestions', !!fim, fim ? fim.name : 'No fill-in-the-middle model'),
    row('Docker (code execution)', s.docker, s.docker ? 'Running' : 'Not running'));
}

// ---------- home ----------
async function renderHome() {
  const root = $('view-home');
  const [questions, problems, mocks, s] = await Promise.all([
    api('/api/coding/questions').catch(() => []), api('/api/problems').catch(() => []), api('/api/mock/list').catch(() => []), status ? Promise.resolve(status) : loadStatus().catch(() => null)]);
  const solved = questions.filter(q => q.status === 'solved').length;
  const reviewed = problems.filter(p => p.best).length;
  // Each card opens with a small wireframe of the screen it leads to.
  const thumbs = {
    code: ['thumb-questions', [el('i', {class: 'lines'}), el('i', {class: 'code'})]],
    repo: ['thumb-repos', [el('i', {class: 'lines'}), el('i', {class: 'bubble'}), el('i', {class: 'code'})]],
    mic: ['thumb-mock', [el('i', {class: 'bubble'}), el('i', {class: 'lines'}), el('i', {class: 'bubble'}), el('i', {class: 'code'})]],
    clock: ['thumb-tests', [el('i', {class: 'lines'}), el('i', {class: 'tint'}), el('i', {class: 'code'})]]
  };
  const card = (href, iconName, title, text, meta, cta) => el('a', {class: 'track-card', href},
    el('div', {class: `track-thumb ${thumbs[iconName][0]}`, 'aria-hidden': 'true'}, el('div', {class: 'frame'}, thumbs[iconName][1])),
    el('div', {class: 'track-icon'}, icon(iconName)),
    el('h2', {text: title}), el('p', {text}),
    el('div', {class: 'track-meta', text: meta}),
    el('span', {class: 'track-cta'}, cta, icon('chevron')));
  const banners = [];
  if (s && !s.ollama) banners.push(el('div', {class: 'notice-banner'}, icon('bulb'), el('p', {}, 'Ollama isn\'t running, so the AI assistant, agent and interviewer are off. Start Ollama and download a model (', el('code', {text: 'ollama pull qwen3:8b'}), ').')));
  if (s && !s.docker) banners.push(el('div', {class: 'notice-banner'}, icon('bulb'), el('p', {text: 'Docker Desktop isn\'t running. Start it to run code for coding questions, Python repos and real-world repos. Guided JavaScript repos still run in your browser.'})));
  const recent = mocks.slice(0, 3);
  root.replaceChildren(
    el('div', {class: 'home-hero'},
      el('p', {class: 'eyebrow', text: 'AI-assisted interview practice'}),
      el('h1', {text: 'Practise the way AI-assisted coding interviews really run.'}),
      el('p', {class: 'page-lead', text: 'Solve coding questions with an AI assistant at your side, work through real codebases with an AI agent you direct and review, and rehearse with an AI interviewer who gives you a scored report.'})),
    ...banners,
    el('div', {class: 'track-grid'},
      card('#/questions', 'code', 'Coding questions', 'Single-file problems with hidden test cases in Python, JavaScript, Java, C++ and Go. Run against samples, submit for a score, and ask the AI assistant when you\'re stuck.', `${questions.length} questions · ${solved} solved`, 'Solve a question'),
      card('#/repos', 'repo', 'Code repos', 'Multi-file codebases in an AI-assisted development environment: file tree, editor, diff, terminal and an agent with Ask, Plan and Agent modes. Guided problems, real open-source issues, or any GitHub repo.', `${problems.length} guided problems · ${reviewed} reviewed`, 'Open a code repo'),
      card('#/tests', 'clock', 'Practice tests', 'Full timed assessments: Test home, Run Code, Run Tests and Save & Proceed, multiple choice, integrity checks and Submit test, then a report with a risk rating, a replay of your coding and AI-usage grades.', 'Sample test · SWE, ML and API/SQL tests · custom tests', 'Take a practice test'),
      card('#/mock', 'mic', 'Mock interviews', 'A live AI interviewer, by text or voice: coding, technical screen, system design, behavioural, AI fluency and ML interviews, plus a repo interview where you work with the agent. Scored feedback at the end.', `${mocks.length} interview${mocks.length === 1 ? '' : 's'} taken`, 'Start an interview')),
    recent.length ? el('section', {class: 'panel'}, el('div', {class: 'panel-title-row'}, el('h2', {text: 'Recent interviews'}), el('a', {href: '#/activity', text: 'All activity →'})),
      el('div', {class: 'recent-list'}, recent.map(m => el('a', {class: 'recent-row', href: m.status === 'ended' ? `#/mockreport/${m.id}` : m.type === 'fluency' ? `#/ade/practice/${m.practiceId}/mock/${m.id}` : `#/mock/${m.id}`},
        el('span', {class: 'recent-title', text: m.title}), el('span', {class: 'muted', text: `${mockLabel(m)} · ${new Date(m.started).toLocaleDateString()}`}),
        m.recommendation ? el('span', {class: `result-chip verdict-text ${VERDICT_CLASS[m.recommendation]}`, text: m.recommendation}) : el('span', {class: 'status-pill active', text: m.status === 'active' ? 'In progress' : 'Reviewing'}))))) : el('span'));
}

// ---------- activity ----------
async function renderActivity() {
  const root = $('view-activity');
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading your activity…'));
  const [questions, practice, open, repos, mocks] = await Promise.all([
    api('/api/coding/questions').catch(() => []), api('/api/practice/history').catch(() => []), api('/api/open/history').catch(() => []), api('/api/repos/history').catch(() => []), api('/api/mock/list').catch(() => [])]);
  const label = {active: 'In progress', debrief: 'Awaiting debrief', reviewing: 'Reviewing', ended: 'Reviewed'};
  const rows = [
    ...mocks.map(m => ({at: m.started, kind: `Mock · ${mockLabel(m)}`, title: m.title, status: m.status === 'ended' ? 'Feedback ready' : m.status === 'active' ? 'In progress' : 'Reviewing', result: m.recommendation, href: m.status === 'ended' ? `#/mockreport/${m.id}` : m.type === 'fluency' ? `#/ade/practice/${m.practiceId}/mock/${m.id}` : `#/mock/${m.id}`})),
    ...practice.filter(p => !p.mock).map(p => ({at: p.started, kind: 'Guided repo', title: p.title, status: p.endReason === 'restarted' ? 'Restarted' : label[p.status] || p.status, result: p.verdict || (p.phasesPassed !== undefined ? `${p.phasesPassed}/3 phases` : ''), href: p.status === 'ended' ? `#/feedback/${p.id}` : `#/ade/practice/${p.id}`})),
    ...repos.map(r => ({at: r.started, kind: r.benchmark ? 'Real-world repo' : r.challenge ? 'Incident' : 'GitHub repo', title: r.title, status: 'Open', result: '', href: `#/ade/repo/${r.id}`})),
    ...open.map(o => ({at: o.started, kind: 'Take-home', title: o.title, status: label[o.status] || o.status, result: o.verdict || '', href: `#/open/${o.id}`}))
  ].sort((x, y) => (y.at || 0) - (x.at || 0));
  const attempted = questions.filter(q => q.status !== 'new');
  root.replaceChildren(
    el('div', {class: 'page-title'}, el('h1', {text: 'Your activity'})),
    el('p', {class: 'page-lead', text: 'Everything is stored locally in the .sessions folder. Reopen a workspace, resume an interview or read your feedback.'}),
    el('div', {class: 'stats-grid'},
      stat(questions.filter(q => q.status === 'solved').length, 'questions solved'), stat(attempted.length, 'questions attempted'),
      stat(practice.filter(p => !p.mock).length + repos.length, 'code repo sessions'), stat(mocks.length, 'mock interviews')),
    attempted.length ? el('section', {class: 'panel'}, el('h2', {text: 'Coding questions'}),
      el('table', {class: 'mini-table'}, el('thead', {}, el('tr', {}, el('th', {text: 'Question'}), el('th', {text: 'Difficulty'}), el('th', {text: 'Status'}), el('th', {text: 'Best score'}))),
        el('tbody', {}, attempted.map(q => el('tr', {}, el('td', {}, el('a', {href: `#/question/${q.id}`, text: q.title})), el('td', {}, el('span', {class: `difficulty ${DIFFICULTY_CLASS[q.difficulty]}`, text: q.difficulty})),
          el('td', {}, el('span', {class: `status-pill ${q.status === 'solved' ? 'passed' : 'active'}`, text: q.status === 'solved' ? 'Solved' : 'Attempted'})), el('td', {text: q.best ? `${q.best.score} / ${q.maxScore}` : '—'})))))) : el('span'),
    el('section', {class: 'panel'}, el('h2', {text: 'Sessions and interviews'}),
      rows.length ? el('table', {class: 'mini-table'}, el('thead', {}, el('tr', {}, el('th', {text: 'What'}), el('th', {text: 'Type'}), el('th', {text: 'Started'}), el('th', {text: 'Status'}), el('th', {text: 'Result'}))),
        el('tbody', {}, rows.map(r => el('tr', {}, el('td', {}, el('a', {href: r.href, text: r.title})), el('td', {text: r.kind}), el('td', {text: r.at ? new Date(r.at).toLocaleString() : '—'}), el('td', {text: r.status}),
          el('td', {}, r.result ? el('span', {class: `result-chip ${VERDICT_CLASS[r.result] ? 'verdict-text ' + VERDICT_CLASS[r.result] : ''}`, text: r.result}) : '—'))))) : el('p', {class: 'muted', text: 'Nothing yet. Pick a coding question, open a code repo or start a mock interview.'})));
}
const MOCK_FORMATS = {screen: 'Technical screen', design: 'System design', behavioral: 'Behavioural', 'ai-fluency': 'AI fluency', 'ml-design': 'ML system design', 'ml-screen': 'ML fundamentals screen', 'ml-deep-dive': 'ML project deep dive'};
const mockLabel = m => m.type === 'coding' ? 'Coding interview' : m.type === 'talk' ? MOCK_FORMATS[m.format] || 'Interview' : 'AI-assisted repo';
const stat = (value, label) => el('div', {class: 'stat'}, el('strong', {text: String(value)}), el('span', {text: label}));

// ---------- prep guides ----------
// Practice that goes with each guide.
const PREP_PRACTICE = {
  'ai-assisted-oa': [['#/tests', 'AI-assisted coding assessment'], ['#/repos', 'Guided code repos'], ['#/mock', 'AI-assisted repo interview']],
  'hackerrank-style-oa': [['#/tests', 'Try the sample test (15 min)'], ['#/tests', 'Software engineer: coding screen']],
  'ml-interviews': [['#/questions', 'ML coding questions'], ['#/tests', 'ML engineer assessment'], ['#/mock', 'ML system design interview']],
  'api-and-backend': [['#/questions', 'REST API and build-an-API questions'], ['#/tests', 'API and SQL back-end assessment']],
  sql: [['#/questions', 'SQL questions'], ['#/tests', 'API and SQL back-end assessment']]
};
async function renderPrep() {
  const root = $('view-prep');
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading the guides…'));
  const guides = await api('/api/prep');
  const read = store.get('dg-prep-read', []);
  root.replaceChildren(
    el('div', {class: 'page-title'}, el('h1', {text: 'Prep guides'}), el('span', {class: 'title-badge', text: `${guides.length} guides`})),
    el('p', {class: 'page-lead', text: 'Short, practical guides to the formats you will meet: AI-assisted rounds, timed online assessments, ML interviews, API and back-end questions, and SQL. Each ends with checklists and links to practise the format here.'}),
    el('section', {class: 'notice-banner info prep-warmup'}, icon('clock'), el('p', {}, el('strong', {text: 'First time? '}), 'Spend five minutes in the sample test before a real assessment: find the editor, Run Code and the AI panel, and send one trivial prompt.'), el('a', {class: 'button primary small', href: '#/tests'}, 'Open practice tests')),
    el('div', {class: 'prep-grid'}, guides.map(g => el('a', {class: `prep-card${read.includes(g.id) ? ' read' : ''}`, href: `#/prep/${g.id}`},
      el('div', {class: 'prep-card-head'}, el('strong', {text: g.title}), read.includes(g.id) ? el('span', {class: 'chip', text: 'Read'}) : null),
      el('p', {class: 'muted small', text: g.summary}),
      el('span', {class: 'chip'}, icon('clock'), `${g.minutes} min read`)))));
}
async function renderPrepGuide(id) {
  const root = $('view-prep');
  const [guide, guides] = await Promise.all([api(`/api/prep/guide?id=${encodeURIComponent(id)}`), api('/api/prep')]);
  store.set('dg-prep-read', [...new Set([...store.get('dg-prep-read', []), guide.id])]);
  const body = el('article', {class: 'md prep-body'}, renderMarkdown(guide.markdown));
  // "- [ ]" items become real checkboxes, remembered per guide.
  const ticks = store.get(`dg-prep-${guide.id}`, {});
  body.querySelectorAll('li').forEach((li, n) => {
    const first = li.firstChild;
    if (first?.nodeType !== Node.TEXT_NODE || !/^\s*\[( |x)\]\s/i.test(first.textContent)) return;
    first.textContent = first.textContent.replace(/^\s*\[( |x)\]\s/i, '');
    const box = el('input', {type: 'checkbox', checked: !!ticks[n], 'aria-label': li.textContent.slice(0, 80), onchange: () => { ticks[n] = box.checked; store.set(`dg-prep-${guide.id}`, ticks); }});
    li.classList.add('check-item');
    li.prepend(box);
  });
  const index = guides.findIndex(g => g.id === guide.id);
  const next = guides[index + 1];
  root.replaceChildren(
    el('a', {class: 'button link', href: '#/prep'}, '← All prep guides'),
    el('div', {class: 'page-title'}, el('h1', {text: guide.title}), el('span', {class: 'title-badge', text: `${guide.minutes} min read`})),
    PREP_PRACTICE[guide.id] ? el('div', {class: 'prep-practice'}, el('strong', {text: 'Practise it: '}), PREP_PRACTICE[guide.id].map(([href, label]) => el('a', {class: 'button small', href}, label))) : null,
    el('section', {class: 'panel prep-panel'}, body),
    next ? el('a', {class: 'prep-next', href: `#/prep/${next.id}`}, el('span', {class: 'muted small', text: 'Next guide'}), el('strong', {text: next.title}), icon('chevron')) : null);
  window.scrollTo(0, 0);
}

// ---------- guide ----------
function renderGuide() {
  const section = (title, md) => el('section', {class: 'panel guide-section'}, el('h2', {text: title}), el('div', {class: 'md'}, renderMarkdown(md)));
  $('view-guide').replaceChildren(el('div', {class: 'guide'},
    el('div', {class: 'page-title'}, el('h1', {text: 'How it works'})),
    el('p', {class: 'page-lead', text: 'AI-assisted interviews give you an AI assistant and judge how you use it: whether you stay in control, verify what it produces, and can explain your decisions. Debug Gym recreates the three formats you are likely to meet.'}),
    section('Coding questions', 'A statement, a starter template whose `main` already reads **stdin** and prints to **stdout**, and a function for you to complete.\n\n- **Run Code** compiles your program and runs the sample test cases. Open the **Custom** tab in Test Results to try your own input.\n- **Submit Code** runs every test case, including hidden ones, and scores you by the share of weighted test cases passed (30, 50 or 80 points for Easy, Medium and Hard).\n- Verdicts: *Success*, *Wrong Answer*, *Runtime Error*, *Terminated due to timeout* (time limits: Python and JavaScript 10 s, Java and Go 4 s, C++ 2 s) and *Compilation error*.\n- The **AI assistant** beside the editor sees the statement and your code. Use *Guided* help for hints only, or *Full* help when you want code.'),
    section('Code repos and the AI agent', 'Code repos open in an AI-assisted development environment: a file tree and editor, a Diff view of everything changed, a Terminal and Tests, and the AI assistant in the middle.\n\n- **Ask** answers questions and reads files. **Plan** investigates and proposes numbered steps. **Agent** edits files, runs commands and runs the tests.\n- Every edit or command the agent wants to make appears as a **pending tool call**: review the diff, then **Allow** or **Cancel**.\n- Type **@** to attach a file, the problem statement, your changes, the terminal output or the latest test results. Type **/** for commands such as `/fix`, `/review` and `/plan`.\n- Each message is a **checkpoint**: *Restore checkpoint* undoes every change the agent made from that message on.\n- **Guided** repos have three timed phases (debug, build, optimize) and end with a debrief and a scored review of problem solving, control over the AI, verification and communication. **Real-world** repos come from public bug-fix datasets with their regression tests. You can also import **any GitHub repository**.'),
    section('Practice tests', 'Timed assessments that behave like real online tests, so the real thing feels familiar.\n\n- **Before you start:** a landing page with the test duration, number of questions and question types, then onboarding: the honor code, the AI notice and any permission checks. **Try Sample Test** gives you a short practice run.\n- **During the test:** **Test home** lists every question (**Solve** / **Modify**), a side list shows question names and status, and the countdown never pauses. With less than 5 minutes left you get a nudge; at zero the test ends.\n- **Coding questions:** **Run Code** runs the samples (or your input in the **Custom** tab), **Run Tests** runs every test case, and **Save & Proceed** records your answer. When time runs out, your last Save & Proceed counts; failing that your last Run Tests, then your last Run Code. **Code you typed but never ran or saved is not evaluated.**\n- **Multiple choice:** single or multiple correct answers with **Clear Selection**. Multiple-answer questions give partial credit, but choosing more options than there are correct answers scores zero. Written answers are graded against a rubric.\n- **Integrity:** tab switches and pastes are always recorded. **Secure mode** enforces full screen, warns when you switch tabs and blocks pasting from outside the test into the code editor. **Proctored** adds a webcam preview (nothing is recorded) and a single-monitor check.\n- **AI:** tests allow no assistant, a **guarded** assistant (hints and explanations, no full solutions) or an **unguarded** one with inline suggestions.\n- **Editor:** the gear icon sets the editor mode (**Normal, Vim, Emacs**), tab spaces, autocomplete and theme; **ⓘ** shows each language\'s version, time limit and memory limit.'),
    section('Mock interviews', '- **Coding interview:** the AI interviewer presents a question, asks for your approach and its complexity, watches your runs and submissions, gives hints when you ask, and follows up after you submit. Talk by text or, in browsers that support it, by voice.\n- **Technical screen, system design, behavioural and AI fluency:** conversation interviews by voice or text. System design adds a notes pane the interviewer reads; AI fluency covers how AI tools work and how you use and verify them.\n- **AI-assisted repo interview:** you solve a guided code repo with the AI agent while the interviewer asks how you frame tasks for the AI, judge its output and steer it.\n- Ending the interview produces a report: each area is scored from 1 to 5 within bounds set by the recorded evidence (tests passed, runs, words spoken, prompts and approvals), with an overall recommendation from **Strong Hire** to **No Hire**. For 15 minutes afterwards you can ask the interviewer about the feedback.'),
    section('Good habits the scores reward', '1. **Orient first.** Read the statement or the code before your first prompt.\n2. **Plan, then delegate one scoped task at a time.** Name files, functions and constraints.\n3. **Review every change before you approve it, then run the tests.** Never stack unverified AI changes.\n4. **Explain** your approach, its complexity and what the AI got right or wrong.'),
    el('p', {class: 'disclaimer', text: 'Scores come from local models and recorded evidence. They are practice feedback, not a hiring decision. Debug Gym is an independent practice tool and is not affiliated with any interview platform.'})));
}

initShell();
loadStatus().catch(() => {});
route();
