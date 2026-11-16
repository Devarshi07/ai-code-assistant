function docsController(docs) {
  return {
    list(req, res) {
      res.json({data: docs.listDocs()});
    },

    show(req, res) {
      res.json(docs.getDoc(req.params.id));
    },

    create(req, res) {
      const doc = docs.createDoc(req.body, req.user);
      res.status(201).location(`/docs/${doc.id}`).json(doc);
    },

    update(req, res) {
      res.json(docs.updateDoc(req.params.id, req.body, req.user));
    },

    remove(req, res) {
      docs.deleteDoc(req.params.id, req.user);
      res.status(204).end();
    }
  };
}

module.exports = {docsController};
