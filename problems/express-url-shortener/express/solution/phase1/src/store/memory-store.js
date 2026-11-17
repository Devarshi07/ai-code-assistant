// An in-memory stand-in for the database. Every method is asynchronous, like a
// real round trip. Slugs are case-insensitive: "Docs" and "docs" are one link,
// so the maps are keyed by the lowercased slug and the link keeps the casing
// its creator chose.
const keyOf = slug => slug.toLowerCase();

function createStore({links = [], latencyMs = 0} = {}) {
  const linkByKey = new Map();
  const clicksByKey = new Map(); // key -> array of click times (epoch ms)
  for (const link of links) linkByKey.set(keyOf(link.slug), {...link});

  const pause = () => (latencyMs > 0 ? new Promise(resolve => setTimeout(resolve, latencyMs)) : Promise.resolve());

  return {
    // The link for a slug in any letter case, or null.
    async findLink(slug) {
      await pause();
      const link = linkByKey.get(keyOf(slug));
      return link ? {...link} : null;
    },

    // Cheap existence check, used before creating a link.
    async hasSlug(slug) {
      await pause();
      return linkByKey.has(keyOf(slug));
    },

    async saveLink(link) {
      await pause();
      linkByKey.set(keyOf(link.slug), {...link});
      return {...link};
    },

    // The owner's links, newest first.
    async listLinksByOwner(owner) {
      await pause();
      return [...linkByKey.values()]
        .filter(link => link.owner === owner)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
        .map(link => ({...link}));
    },

    // One visit to the link, at atMs (epoch milliseconds).
    async recordClick(slug, atMs) {
      await pause();
      const key = keyOf(slug);
      if (!clicksByKey.has(key)) clicksByKey.set(key, []);
      clicksByKey.get(key).push(atMs);
    },

    // Every recorded click time for the link, oldest first.
    async listClicks(slug) {
      await pause();
      return [...(clicksByKey.get(keyOf(slug)) || [])];
    }
  };
}

module.exports = {createStore};
