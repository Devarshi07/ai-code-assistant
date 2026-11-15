// Route patterns: literal segments, `*` (one segment) and a trailing `**` (one or more).
const { ConfigError } = require('./errors');

const LITERAL = 0, STAR = 1, GLOBSTAR = 2;

class Pattern {
  constructor(text) {
    if (typeof text !== 'string' || !text.startsWith('/')) throw new ConfigError(`pattern ${JSON.stringify(text)} must start with '/'`);
    const segments = text.slice(1).split('/');
    segments.forEach((segment, index) => {
      if (!segment) throw new ConfigError(`pattern ${JSON.stringify(text)} has an empty segment`);
      if (segment.includes('*') && segment !== '*' && segment !== '**') throw new ConfigError(`pattern ${JSON.stringify(text)}: '*' must be a whole segment`);
      if (segment === '**' && index !== segments.length - 1) throw new ConfigError(`pattern ${JSON.stringify(text)}: '**' is only allowed last`);
    });
    this.text = text;
    this.segments = segments;
    // Lower ranks are more specific. Distinct patterns that match the same route
    // always differ at some position, so the comparison never ties.
    this.rank = segments.map(s => (s === '**' ? GLOBSTAR : s === '*' ? STAR : LITERAL));
  }

  matches(routeSegments) {
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (segment === '**') return routeSegments.length > i;
      if (i >= routeSegments.length) return false;
      if (segment !== '*' && segment !== routeSegments[i]) return false;
    }
    return routeSegments.length === this.segments.length;
  }

  /** Negative if this pattern is more specific than `other`. */
  compare(other) {
    const n = Math.min(this.rank.length, other.rank.length);
    for (let i = 0; i < n; i++) if (this.rank[i] !== other.rank[i]) return this.rank[i] - other.rank[i];
    return this.rank.length - other.rank.length;
  }
}

module.exports = { Pattern };
