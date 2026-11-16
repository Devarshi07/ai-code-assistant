const {NotFoundError, ValidationError, ForbiddenError} = require('../errors');

const MAX_TITLE = 120;
const MAX_BODY = 20000;

// Checks a create (partial = false) or update (partial = true) body and
// returns only the known fields.
function parseDocInput(input, {partial}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError({body: 'must be a JSON object'});
  const fields = {};
  const out = {};
  if (input.title !== undefined || !partial) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title || title.length > MAX_TITLE) fields.title = `must be 1 to ${MAX_TITLE} characters`;
    else out.title = title;
  }
  if (input.body !== undefined || !partial) {
    if (typeof input.body !== 'string' || input.body.length > MAX_BODY) fields.body = `must be text of at most ${MAX_BODY} characters`;
    else out.body = input.body;
  }
  if (partial && input.title === undefined && input.body === undefined) fields.body = 'send at least one of title, body';
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return out;
}

function createDocService({store, clock}) {
  const timestamp = () => new Date(clock()).toISOString();

  function listDocs() {
    return store.listDocs().sort((a, b) => a.id.localeCompare(b.id));
  }

  function getDoc(id) {
    const doc = store.getDoc(id);
    if (!doc) throw new NotFoundError('Document', id);
    return doc;
  }

  function createDoc(input, user) {
    const fields = parseDocInput(input, {partial: false});
    const now = timestamp();
    return store.insertDoc({...fields, ownerId: user.id, createdAt: now, updatedAt: now});
  }

  // Editors may only change documents they own; admins may change any.
  function updateDoc(id, input, user) {
    const doc = getDoc(id);
    if (user.role !== 'admin' && doc.ownerId !== user.id) {
      throw new ForbiddenError('Editors can only change their own documents.');
    }
    const changes = parseDocInput(input, {partial: true});
    return store.updateDoc(id, {...changes, updatedAt: timestamp()});
  }

  function deleteDoc(id) {
    getDoc(id);
    store.deleteDoc(id);
  }

  return {listDocs, getDoc, createDoc, updateDoc, deleteDoc};
}

module.exports = {createDocService};
