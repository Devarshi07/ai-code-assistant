// Weight units.
//
// Inside the service every weight is a whole number of grams. The WMS export
// and the carrier labels use kilograms, so conversions happen only at the
// edges: parseWeightKg when an export is loaded, format* when printing.

const GRAMS_PER_KG = 1000;

// The pack-bench scales read to the gram, so the export never carries more
// than three decimal places: "2", "0.5", "1.25", "0.035".
const READING = /^\d+(\.\d+)?$/;

/** Convert a kilogram reading from the WMS export to whole grams. */
function parseWeightKg(text) {
  const cleaned = String(text).trim();
  if (!READING.test(cleaned)) throw new Error(`weight '${text}' is not a kilogram reading like 1.25`);
  const kilograms = Number(cleaned);
  // Binary floats store 2.03 as 2.02999..., so rounding down would lose a gram.
  return Math.round(kilograms * GRAMS_PER_KG);
}

/** 5435 -> '5,435 g' */
function formatGrams(grams) {
  return `${String(grams).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} g`;
}

/** 5435 -> '5.435 kg', the format printed on carrier labels. */
function formatKg(grams) {
  return `${Math.floor(grams / GRAMS_PER_KG)}.${String(grams % GRAMS_PER_KG).padStart(3, '0')} kg`;
}

module.exports = { GRAMS_PER_KG, parseWeightKg, formatGrams, formatKg };
