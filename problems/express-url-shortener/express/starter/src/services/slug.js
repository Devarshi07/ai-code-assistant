// Generated slugs: 6 characters, lowercase only (no 0/o/1/l/i lookalikes),
// so they never differ from another slug only by letter case.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const SLUG_LENGTH = 6;

// random: () => number in [0, 1), injectable so tests are deterministic.
function generateSlug(random = Math.random) {
  let slug = '';
  for (let i = 0; i < SLUG_LENGTH; i++) slug += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return slug;
}

module.exports = {generateSlug, SLUG_LENGTH};
