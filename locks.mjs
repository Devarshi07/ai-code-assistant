// Serializes read-modify-write cycles on one session file or folder.
const locks = new Map();

export async function exclusive(key, action) {
  const previous = locks.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  locks.set(key, next);
  try { return await next; }
  finally { if (locks.get(key) === next) locks.delete(key); }
}
