// Building blocks for feedback reports, shared by structured and open-ended sessions.
import {el, icon, VERDICT_CLASS} from './ui.js';

export function verdictHero(report) {
  const source = report.generatedBy === 'rules' ? 'rule-based scoring (no AI reviewer available)' : `reviewed by ${report.generatedBy}`;
  return el('section', {class: 'verdict-hero'},
    el('div', {class: `verdict-badge ${VERDICT_CLASS[report.verdict]}`}, el('div', {}, el('small', {text: 'Practice verdict'}), report.verdict)),
    el('div', {},
      el('p', {class: 'headline', text: report.headline}),
      el('p', {text: `Average ${report.average.toFixed(2)} / 4 across four areas · ${source}`}),
      el('p', {class: 'disclaimer', text: report.disclaimer})));
}

export function areaCard(area) {
  return el('article', {class: 'area-card'},
    el('header', {}, el('h3', {text: area.label}),
      el('span', {}, el('span', {class: `score-bar s${area.score}`, role: 'img', 'aria-label': `${area.score} out of 4`}, el('i'), el('i'), el('i'), el('i')), el('span', {class: 'score-label', text: area.level}))),
    el('p', {class: 'desc', text: area.description}),
    el('p', {text: area.summary}),
    el('ul', {},
      area.strengths.map(s => el('li', {class: 'good'}, icon('check'), el('span', {text: s}))),
      area.improvements.map(s => el('li', {class: 'todo'}, icon('chevron'), el('span', {text: s})))),
    el('div', {class: 'evidence'}, el('strong', {text: 'Recorded evidence'}), area.evidence.map(e => el('p', {text: e}))));
}

export const areaGrid = report => el('div', {class: 'area-grid'}, report.areas.map(areaCard));

export const fixesPanel = report => el('section', {class: 'panel'}, el('h2', {text: 'What to fix before the real thing'}), el('ol', {class: 'fix-list'}, report.topFixes.map(f => el('li', {text: f}))));

export const stat = (value, label) => el('div', {class: 'stat'}, el('strong', {text: String(value)}), el('span', {text: label}));
