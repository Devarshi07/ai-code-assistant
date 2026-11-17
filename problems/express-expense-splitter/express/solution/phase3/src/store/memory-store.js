// An in-memory stand-in for the database. Like a real database client, every
// call is asynchronous and takes a little time (latencyMs per round trip).
// Groups come back as copies. Expenses are immutable once written, so lists
// share the stored objects: treat them as read-only.
//
// The store also keeps a running ledger per group: each member's net balance,
// updated in the same synchronous step that appends an expense or a
// settlement, so reading a balance never has to walk the history.

const clone = value => structuredClone(value);
const sequenceOf = (items, prefix) => items.reduce((max, item) => Math.max(max, Number(item.id.slice(prefix.length)) || 0), 0);

class MemoryStore {
  constructor({groups = [], expenses = [], settlements = [], latencyMs = 1} = {}) {
    this.latencyMs = latencyMs;
    this.ledgers = new Map();
    this.groups = new Map(groups.map(group => [group.id, clone(group)]));
    this.expenses = new Map();
    this.expensesByGroup = new Map();
    for (const expense of expenses) this.addExpense(expense);
    this.settlements = new Map();
    this.settlementsByGroup = new Map();
    for (const settlement of settlements) this.addSettlement(settlement);
    this.groupSequence = sequenceOf(groups, 'grp_');
    this.expenseSequence = sequenceOf(expenses, 'exp_');
    this.settlementSequence = sequenceOf(settlements, 'set_');
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

  // The ledger of a group: Map of memberId -> net cents.
  ledgerOf(groupId) {
    let ledger = this.ledgers.get(groupId);
    if (!ledger) this.ledgers.set(groupId, ledger = new Map());
    return ledger;
  }

  // A member's balance moves by `delta`; the ledger only holds non-default entries.
  adjust(ledger, memberId, delta) {
    ledger.set(memberId, (ledger.get(memberId) || 0) + delta);
  }

  // A copy of the group's ledger. Members who never appear are not listed.
  async getBalances(groupId) {
    await this.roundTrip();
    return new Map(this.ledgers.get(groupId) || []);
  }

  addExpense(expense) {
    const ledger = this.ledgerOf(expense.groupId);
    this.adjust(ledger, expense.payerId, expense.amountCents);
    for (const share of expense.shares) this.adjust(ledger, share.memberId, -share.cents);
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

  // Settlements: payments between members

  nextSettlementId() {
    this.settlementSequence += 1;
    return `set_${String(this.settlementSequence).padStart(5, '0')}`;
  }

  addSettlement(settlement) {
    const ledger = this.ledgerOf(settlement.groupId);
    this.adjust(ledger, settlement.fromId, settlement.amountCents);
    this.adjust(ledger, settlement.toId, -settlement.amountCents);
    this.settlements.set(settlement.id, settlement);
    let list = this.settlementsByGroup.get(settlement.groupId);
    if (!list) this.settlementsByGroup.set(settlement.groupId, list = []);
    list.push(settlement);
  }

  async insertSettlement(settlement) {
    await this.roundTrip();
    if (this.settlements.has(settlement.id)) throw new Error(`Duplicate settlement id ${settlement.id}`);
    this.addSettlement(Object.freeze(clone(settlement)));
    return clone(settlement);
  }

  async getSettlement(id) {
    await this.roundTrip();
    const settlement = this.settlements.get(id);
    return settlement ? clone(settlement) : null;
  }

  // Every settlement of a group, oldest first.
  async listSettlements(groupId) {
    await this.roundTrip();
    return [...(this.settlementsByGroup.get(groupId) || [])];
  }
}

const createStore = options => new MemoryStore(options);

module.exports = {MemoryStore, createStore};
