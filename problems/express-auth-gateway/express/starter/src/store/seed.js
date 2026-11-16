// Sample data for `npm start` and demo.js. Tests build their own stores.
// Secrets are only examples; real tokens would be stored hashed.

const users = [
  {id: 'usr_ada', name: 'Ada Okafor', role: 'admin'},
  {id: 'usr_eli', name: 'Eli Brandt', role: 'editor'},
  {id: 'usr_fay', name: 'Fay Moreno', role: 'editor'},
  {id: 'usr_vic', name: 'Vic Lindqvist', role: 'viewer'}
];

const tokens = [
  {id: 'tok_ada', userId: 'usr_ada', secret: 'ink_ada_5d1f9e2c', revoked: false},
  {id: 'tok_eli', userId: 'usr_eli', secret: 'ink_eli_93b07a41', revoked: false},
  {id: 'tok_fay', userId: 'usr_fay', secret: 'ink_fay_c4e8d210', revoked: false},
  {id: 'tok_vic', userId: 'usr_vic', secret: 'ink_vic_17aa60f3', revoked: false}
];

const docs = [
  {id: 'doc_0001', title: 'Onboarding checklist', body: 'Laptop, accounts, first-week buddy.', ownerId: 'usr_eli', createdAt: '2026-01-12T09:00:00.000Z', updatedAt: '2026-01-12T09:00:00.000Z'},
  {id: 'doc_0002', title: 'On-call runbook', body: 'Page the secondary after 15 minutes.', ownerId: 'usr_fay', createdAt: '2026-01-20T14:30:00.000Z', updatedAt: '2026-02-02T10:05:00.000Z'}
];

module.exports = {users, tokens, docs};
