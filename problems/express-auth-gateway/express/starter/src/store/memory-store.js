// In-memory tables for users, API tokens, documents and the audit log.
// Records go in and come out as copies.

const clone = value => structuredClone(value);

class MemoryStore {
  constructor({users = [], tokens = [], docs = []} = {}) {
    this.users = new Map(users.map(user => [user.id, clone(user)]));
    this.tokens = new Map(tokens.map(token => [token.id, clone(token)]));
    this.tokenIdBySecret = new Map(tokens.map(token => [token.secret, token.id]));
    this.docs = new Map(docs.map(doc => [doc.id, clone(doc)]));
    this.docSequence = docs.reduce((max, doc) => Math.max(max, Number(doc.id.slice(4)) || 0), 0);
    this.auditEntries = [];
  }

  // Users and tokens

  getUser(id) {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  findTokenBySecret(secret) {
    const id = this.tokenIdBySecret.get(secret);
    return id ? clone(this.tokens.get(id)) : null;
  }

  getToken(id) {
    const token = this.tokens.get(id);
    return token ? clone(token) : null;
  }

  updateToken(id, changes) {
    const token = this.tokens.get(id);
    if (!token) return null;
    Object.assign(token, clone(changes));
    return clone(token);
  }

  // Documents

  listDocs() {
    return [...this.docs.values()].map(clone);
  }

  getDoc(id) {
    const doc = this.docs.get(id);
    return doc ? clone(doc) : null;
  }

  insertDoc(fields) {
    this.docSequence += 1;
    const doc = {id: `doc_${String(this.docSequence).padStart(4, '0')}`, ...clone(fields)};
    this.docs.set(doc.id, doc);
    return clone(doc);
  }

  updateDoc(id, changes) {
    const doc = this.docs.get(id);
    if (!doc) return null;
    Object.assign(doc, clone(changes));
    return clone(doc);
  }

  deleteDoc(id) {
    return this.docs.delete(id);
  }

  // Audit log: append-only. Each entry gets an increasing seq number and an
  // id like aud_000042. listAudit returns entries oldest first.

  appendAudit(fields) {
    const seq = this.auditEntries.length + 1;
    const entry = {id: `aud_${String(seq).padStart(6, '0')}`, seq, ...clone(fields)};
    this.auditEntries.push(entry);
    return clone(entry);
  }

  listAudit() {
    return this.auditEntries.map(clone);
  }
}

const createStore = options => new MemoryStore(options);

module.exports = {MemoryStore, createStore};
