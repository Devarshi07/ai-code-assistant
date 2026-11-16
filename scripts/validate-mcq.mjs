// Checks every multiple-choice and written-answer question in mcq/.
import {loadMcqBank, MCQ_TOPICS} from '../mcq.mjs';

const bank = await loadMcqBank({fresh: true});
for (const problem of bank.problems) console.log(`✗ ${problem}`);
const byTopic = Object.fromEntries(MCQ_TOPICS.map(t => [t, bank.mcq.filter(q => q.topic === t).length]));
console.log(`${bank.mcq.length} multiple-choice questions (${bank.mcq.filter(q => q.type === 'multiple').length} with several answers), ${bank.subjective.length} written-answer questions`);
console.log(Object.entries(byTopic).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`).join(' · '));
process.exit(bank.problems.length ? 1 : 0);
