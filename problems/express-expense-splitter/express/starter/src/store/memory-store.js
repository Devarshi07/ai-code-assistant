// An in-memory stand-in for the database. Like a real database client, every
// call is asynchronous and takes a little time (latencyMs per round trip).
// Groups come back as copies. Expenses are immutable once written, so lists
// share the stored objects: treat them as read-only.

const clone = value => structuredClone(value);
const sequenceOf = (items, prefix) => items.reduce((max, item) => Math.max(max, Number(item.id.slice(prefix.length)) || 0), 0);

class MemoryStore {
  constructor({groups = [], expenses = [], latencyMs = 1} = {}) {
    this.latencyMs = latencyMs;
    this.groups = new Map(groups.map(group => [group.id, clone(group)]));
    this.expenses = new Map();
    this.expensesByGroup = new Map();
    for (const expense of expenses) this.addExpense(expense);
    this.groupSequence = sequenceOf(groups, 'grp_');
    this.expenseSequence = sequenceOf(expenses, 'exp_');
  }

  roundTrip() {
    return this.latencyMs > 0 ? new Promise(resolve => setTimeout(resolve, this.latencyMs)) : Promise.resolve();
  }

  // Groups

  nextGroupId() {
    this.groupSequence += 1;
    return `grp_${String(this.groupSequence).padStart(5, '0')}`;
  }

  async insertGroup(group) {
    await this.roundTrip();
    if (this.groups.has(group.id)) throw new Error(`Duplicate group id ${group.id}`);
    this.groups.set(group.id, clone(group));
    return clone(group);
  }

  async getGroup(id) {
    await this.roundTrip();
    const group = this.groups.get(id);
    return group ? clone(group) : null;
  }

  async listGroups() {
    await this.roundTrip();
    return [...this.groups.values()].map(clone);
  }

  // Expenses

  nextExpenseId() {
    this.expenseSequence += 1;
    return `exp_${String(this.expenseSequence).padStart(6, '0')}`;
  }

  addExpense(expense) {
    this.expenses.set(expense.id, expense);
    let list = this.expensesByGroup.get(expense.groupId);
    if (!list) this.expensesByGroup.set(expense.groupId, list = []);
    list.push(expense);
  }

  async insertExpense(expense) {
    await this.roundTrip();
    if (this.expenses.has(expense.id)) throw new Error(`Duplicate expense id ${expense.id}`);
    this.addExpense(Object.freeze(clone(expense)));
    return clone(expense);
  }

  async getExpense(id) {
    await this.roundTrip();
    const expense = this.expenses.get(id);
    return expense ? clone(expense) : null;
  }

  // Every expense of a group, oldest first.
  async listExpenses(groupId) {
    await this.roundTrip();
    return [...(this.expensesByGroup.get(groupId) || [])];
  }
}

const createStore = options => new MemoryStore(options);

module.exports = {MemoryStore, createStore};
