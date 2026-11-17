// Controllers read the request, call the service and choose the status code.
// Business rules live in services/link-service.js.
function linksController(links) {
  return {
    async create(req, res) {
      const link = await links.create(req.userId, req.body);
      res.status(201).set('Location', `/api/links/${link.slug}`).json(link);
    },

    async list(req, res) {
      res.json({links: await links.listForOwner(req.userId)});
    },

    async show(req, res) {
      res.json(await links.get(req.params.slug));
    },

    async stats(req, res) {
      res.json(await links.getStats(req.params.slug, req.userId, req.query));
    },

    // GET /:slug: count the click and send the visitor on.
    async redirect(req, res) {
      const url = await links.resolve(req.params.slug);
      res.redirect(302, url);
    }
  };
}

module.exports = {linksController};
