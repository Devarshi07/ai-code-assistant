// Spell-checks a few sample notes and prints what the editor would show.
import { Dictionary } from './src/dictionary.ts';
import { SpellChecker } from './src/checker.ts';
import { formatReport, underline } from './src/report.ts';

const NOTES: Record<string, string> = {
  'standup.txt': [
    'Standup, Tuesday',
    "Shipped the new calender view. We'll fix the seperate login bugs tomorow.",
    "Don't forget: the team's retro moved to 3pm.",
  ].join('\n'),
  'groceries.txt': [
    'Groceries - milk, eggs, bread, cheese and 2 bananas',
    'Pick up the reciept for the dinner party',
  ].join('\n'),
  'trip.txt': [
    'Flight on the 14th. Hotel is definately booked,',
    'but I havent got the passport back yet. Teh tickets are in my email.',
  ].join('\n'),
};

function main(): void {
  const checker = new SpellChecker(Dictionary.load());
  console.log(`Dictionary: ${checker.dictionary.size} words\n`);
  for (const [name, text] of Object.entries(NOTES)) {
    const issues = checker.check(text);
    console.log(`== ${name}`);
    console.log(underline(text, issues));
    console.log('');
    try {
      console.log(formatReport(text, issues, word => checker.suggest(word)));
    } catch (error) {
      console.log(formatReport(text, issues));
      console.log(`  (suggestions unavailable: ${(error as Error).message})`);
    }
    console.log('');
  }
}

main();
