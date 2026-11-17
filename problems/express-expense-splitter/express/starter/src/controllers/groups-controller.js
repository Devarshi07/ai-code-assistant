// HTTP in, HTTP out: controllers read the request, call the service and
// choose the status code. Business rules live in the services.
function groupsController(groups) {
  return {
    async list(req, res) {
      res.json({data: await groups.listGroups()});
    },

    async create(req, res) {
      const group = await groups.createGroup(req.body);
      res.status(201).location(`/api/groups/${group.id}`).json(group);
    },

    async show(req, res) {
      res.json(await groups.getGroup(req.params.groupId));
    }
  };
}

module.exports = {groupsController};
