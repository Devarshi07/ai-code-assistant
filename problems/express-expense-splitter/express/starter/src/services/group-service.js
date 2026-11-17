const {NotFoundError} = require('../errors');
const {parseGroupInput} = require('../validation');

// Loads a group or throws the 404 every group-scoped endpoint shares.
async function requireGroup(store, groupId) {
  const group = await store.getGroup(groupId);
  if (!group) throw new NotFoundError('Group', groupId);
  return group;
}

function createGroupService({store, now = () => new Date()}) {
  async function createGroup(body) {
    const input = parseGroupInput(body);
    return store.insertGroup({
      id: store.nextGroupId(),
      ...input,
      createdAt: now().toISOString()
    });
  }

  async function getGroup(groupId) {
    return requireGroup(store, groupId);
  }

  async function listGroups() {
    return store.listGroups();
  }

  return {createGroup, getGroup, listGroups};
}

module.exports = {createGroupService, requireGroup};
