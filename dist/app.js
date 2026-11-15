// The app shell: navigation, routing, local setup, the home page, your
// activity and the guide. Each area lives in its own module.
import {$, el, api, waitJob, notify, store, icon, icons, DIFFICULTY_CLASS, VERDICT_CLASS} from './ui.js';
import {renderMarkdown} from './markdown.js';

const views = ['home', 'questions', 'repos', 'mock', 'activity', 'guide', 'feedback', 'open', 'mockreport'];
const fullscreens = ['coding-ide', 'ade', 'mock-room'];
let status = null;
const modules = {};
const load = name => modules[name] ||= import(`./${name}.js`);

export function getStatus() { return status; }

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
    const module = {'coding-ide': 'coding', ade: 'ade', 'mock-room': 'mock'}[id];
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
  document.querySelector('.menu.floating')?.remove();
  const [section, a, b, c, d] = parts;
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
    await closeFullscreens();
    if (section === 'questions') { show('questions'); setNav('questions'); document.title = 'Coding questions · Debug Gym'; await (await load('coding')).renderLibrary($('view-questions')); }
    else if (section === 'repos') { show('repos'); setNav('repos'); document.title = 'Code repos · Debug Gym'; await (await load('repos')).renderRepos($('view-repos'), a || 'guided'); }
    else if (section === 'feedback' && a) { show('feedback'); setNav('activity'); document.title = 'Feedback · Debug Gym'; await (await load('repos')).renderFeedback($('view-feedback'), a); }
    else if (section === 'open' && a) { show('open'); setNav('repos'); document.title = 'Open-ended session · Debug Gym'; await (await load('open-ended')).renderOpenSession($('view-open'), a, {loadStatus}); }
    else if (section === 'mock') { show('mock'); setNav('mock'); document.title = 'Mock interviews · Debug Gym'; await (await load('mock')).renderMockLobby($('view-mock')); }
    else if (section === 'mockreport' && a) { show('mockreport'); setNav('mock'); document.title = 'Interview feedback · Debug Gym'; await (await load('mock')).renderReport($('view-mockreport'), a); }
    else if (section === 'activity') { show('activity'); setNav('activity'); document.title = 'Your activity · Debug Gym'; await renderActivity(); }
    else if (section === 'guide') { show('guide'); setNav('guide'); document.title = 'How it works · Debug Gym'; renderGuide(); }
    else { show('home'); setNav('home'); document.title = 'Debug Gym · AI-assisted coding practice'; await renderHome(); }
  } catch (error) {
    notify(error.message, 'error');
    if (section === 'question') location.hash = '#/questions';
    else if (section === 'ade') location.hash = '#/repos';
    else if (section === 'mock' && a) location.hash = '#/mock';
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
  const card = (href, iconName, title, text, meta, cta) => el('a', {class: 'track-card', href},
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
      card('#/mock', 'mic', 'Mock interviews', 'A live interview with an AI interviewer, by text or voice. A coding interview, or an AI-fluency interview where you work with the agent while it watches. Scored feedback at the end.', `${mocks.length} interview${mocks.length === 1 ? '' : 's'} taken`, 'Start an interview')),
    recent.length ? el('section', {class: 'panel'}, el('div', {class: 'panel-title-row'}, el('h2', {text: 'Recent interviews'}), el('a', {href: '#/activity', text: 'All activity →'})),
      el('div', {class: 'recent-list'}, recent.map(m => el('a', {class: 'recent-row', href: m.status === 'ended' ? `#/mockreport/${m.id}` : m.type === 'fluency' ? `#/ade/practice/${m.practiceId}/mock/${m.id}` : `#/mock/${m.id}`},
        el('span', {class: 'recent-title', text: m.title}), el('span', {class: 'muted', text: `${m.type === 'coding' ? 'Coding interview' : 'AI fluency'} · ${new Date(m.started).toLocaleDateString()}`}),
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
    ...mocks.map(m => ({at: m.started, kind: m.type === 'coding' ? 'Mock · coding' : 'Mock · AI fluency', title: m.title, status: m.status === 'ended' ? 'Feedback ready' : m.status === 'active' ? 'In progress' : 'Reviewing', result: m.recommendation, href: m.status === 'ended' ? `#/mockreport/${m.id}` : m.type === 'fluency' ? `#/ade/practice/${m.practiceId}/mock/${m.id}` : `#/mock/${m.id}`})),
    ...practice.filter(p => !p.mock).map(p => ({at: p.started, kind: 'Guided repo', title: p.title, status: label[p.status] || p.status, result: p.verdict || (p.phasesPassed !== undefined ? `${p.phasesPassed}/3 phases` : ''), href: p.status === 'ended' ? `#/feedback/${p.id}` : `#/ade/practice/${p.id}`})),
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
const stat = (value, label) => el('div', {class: 'stat'}, el('strong', {text: String(value)}), el('span', {text: label}));

// ---------- guide ----------
function renderGuide() {
  const section = (title, md) => el('section', {class: 'panel guide-section'}, el('h2', {text: title}), el('div', {class: 'md'}, renderMarkdown(md)));
  $('view-guide').replaceChildren(el('div', {class: 'guide'},
    el('div', {class: 'page-title'}, el('h1', {text: 'How it works'})),
    el('p', {class: 'page-lead', text: 'AI-assisted interviews give you an AI assistant and judge how you use it: whether you stay in control, verify what it produces, and can explain your decisions. Debug Gym recreates the three formats you are likely to meet.'}),
    section('Coding questions', 'A statement, a starter template whose `main` already reads **stdin** and prints to **stdout**, and a function for you to complete.\n\n- **Run Code** compiles your program and runs the sample test cases. Tick **Test against custom input** to try your own input.\n- **Submit Code** runs every test case, including hidden ones, and scores you by the share of weighted test cases passed (30, 50 or 80 points for Easy, Medium and Hard).\n- Verdicts: *Success*, *Wrong Answer*, *Runtime Error*, *Terminated due to timeout* (time limits: Python and JavaScript 10 s, Java and Go 4 s, C++ 2 s) and *Compilation error*.\n- The **AI assistant** beside the editor sees the statement and your code. Use *Guided* help for hints only, or *Full* help when you want code.'),
    section('Code repos and the AI agent', 'Code repos open in an AI-assisted development environment: a file tree and editor, a Diff view of everything changed, a Terminal and Tests, and the AI assistant in the middle.\n\n- **Ask** answers questions and reads files. **Plan** investigates and proposes numbered steps. **Agent** edits files, runs commands and runs the tests.\n- Every edit or command the agent wants to make appears as a **pending tool call**: review the diff, then **Allow** or **Cancel**.\n- Type **@** to attach a file, the problem statement, your changes, the terminal output or the latest test results. Type **/** for commands such as `/fix`, `/review` and `/plan`.\n- Each message is a **checkpoint**: *Restore checkpoint* undoes every change the agent made from that message on.\n- **Guided** repos have three timed phases (debug, build, optimize) and end with a debrief and a scored review of problem solving, control over the AI, verification and communication. **Real-world** repos come from public bug-fix datasets with their regression tests. You can also import **any GitHub repository**.'),
    section('Mock interviews', '- **Coding interview:** the AI interviewer presents a question, asks for your approach and its complexity, watches your runs and submissions, gives hints when you ask, and follows up after you submit. Talk by text or, in browsers that support it, by voice.\n- **AI-fluency interview:** you solve a guided code repo with the AI agent while the interviewer asks how you frame tasks for the AI, judge its output and steer it.\n- Ending the interview produces a report: each area is scored from 1 to 5 within bounds set by the recorded evidence (tests passed, runs, words spoken, prompts and approvals), with an overall recommendation from **Strong Hire** to **No Hire**. For 15 minutes afterwards you can ask the interviewer about the feedback.'),
    section('Good habits the scores reward', '1. **Orient first.** Read the statement or the code before your first prompt.\n2. **Plan, then delegate one scoped task at a time.** Name files, functions and constraints.\n3. **Review every change before you approve it, then run the tests.** Never stack unverified AI changes.\n4. **Explain** your approach, its complexity and what the AI got right or wrong.'),
    el('p', {class: 'disclaimer', text: 'Scores come from local models and recorded evidence. They are practice feedback, not a hiring decision. Debug Gym is an independent practice tool and is not affiliated with any interview platform.'})));
}

initShell();
loadStatus().catch(() => {});
route();
