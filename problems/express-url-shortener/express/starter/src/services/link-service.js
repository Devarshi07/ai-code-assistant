const {ConflictError, NotFoundError, GoneError} = require('../errors');
const {parseCreateInput} = require('../validation');
const {generateSlug} = require('./slug');

const MAX_SLUG_ATTEMPTS = 8;

// now: () => Date, random: () => number in [0, 1); both injectable for tests.
function createLinkService({store, now = () => new Date(), random = Math.random}) {
  const isExpired = link => link.expiresAt !== null && Date.parse(link.expiresAt) <= now().getTime();

  async function freshSlug() {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = generateSlug(random);
      if (!(await store.hasSlug(slug))) return slug;
    }
    throw new Error('Could not find a free slug.');
  }

  async function requireLink(slug) {
    const link = await store.findLink(slug);
    if (!link) throw new NotFoundError(slug);
    return link;
  }

  return {
    // POST /api/links: a custom alias, or a generated slug when none is given.
    async create(owner, body) {
      const input = parseCreateInput(body, now());
      let slug = input.alias;
      if (slug) {
        if (await store.hasSlug(slug)) throw new ConflictError('alias_taken', `The alias "${slug}" is already taken.`);
      } else {
        slug = await freshSlug();
      }
      return store.saveLink({
        slug,
        url: input.url,
        owner,
        createdAt: now().toISOString(),
        expiresAt: input.expiresAt
      });
    },

    async get(slug) {
      return requireLink(slug);
    },

    async listForOwner(owner) {
      return store.listLinksByOwner(owner);
    },

    // GET /:slug: the target URL, after counting the click.
    // Unknown slugs are 404; expired links are 410 and are not counted.
    async resolve(slug) {
      const link = await requireLink(slug);
      if (isExpired(link)) throw new GoneError(link.slug);
      await store.recordClick(link.slug, now().getTime());
      return link.url;
    },

    // GET /api/links/:slug/stats?from=&to=
    async getStats(slug, userId, query) {
      throw new Error('Not implemented: click statistics for a link (phase 2)');
    }
  };
}

module.exports = {createLinkService};
