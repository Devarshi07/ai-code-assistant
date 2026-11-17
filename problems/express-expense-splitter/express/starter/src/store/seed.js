// Sample data for `npm start` and demo.js. Tests build their own stores.

const groups = [
  {
    id: 'grp_flat', name: 'Maple Street flat', currency: 'EUR', createdAt: '2026-01-10T09:00:00.000Z',
    members: [
      {id: 'mem_ana', name: 'Ana'},
      {id: 'mem_ben', name: 'Ben'},
      {id: 'mem_chen', name: 'Chen'},
      {id: 'mem_dana', name: 'Dana'}
    ]
  },
  {
    id: 'grp_lisbon', name: 'Lisbon trip', currency: 'USD', createdAt: '2026-02-01T18:30:00.000Z',
    members: [
      {id: 'mem_eli', name: 'Eli'},
      {id: 'mem_fay', name: 'Fay'},
      {id: 'mem_gus', name: 'Gus'}
    ]
  }
];

const expense = (id, groupId, description, payerId, amountCents, split, shares, createdAt) => ({
  id, groupId, description, payerId, amountCents,
  currency: groups.find(group => group.id === groupId).currency,
  split, shares, createdAt
});

const everyone = ['mem_ana', 'mem_ben', 'mem_chen', 'mem_dana'];
const expenses = [
  expense('exp_000001', 'grp_flat', 'January groceries', 'mem_ana', 12000,
    {type: 'equal', memberIds: everyone},
    everyone.map(memberId => ({memberId, cents: 3000})), '2026-01-12T17:20:00.000Z'),
  expense('exp_000002', 'grp_flat', 'Takeaway', 'mem_chen', 1000,
    {type: 'equal', memberIds: ['mem_ana', 'mem_ben', 'mem_chen']},
    [{memberId: 'mem_ana', cents: 334}, {memberId: 'mem_ben', cents: 333}, {memberId: 'mem_chen', cents: 333}],
    '2026-01-15T20:45:00.000Z'),
  expense('exp_000003', 'grp_lisbon', 'Apartment', 'mem_eli', 30000,
    {type: 'shares', shares: {mem_eli: 1, mem_fay: 1, mem_gus: 2}},
    [{memberId: 'mem_eli', cents: 7500}, {memberId: 'mem_fay', cents: 7500}, {memberId: 'mem_gus', cents: 15000}],
    '2026-02-03T10:00:00.000Z')
];

module.exports = {groups, expenses};
