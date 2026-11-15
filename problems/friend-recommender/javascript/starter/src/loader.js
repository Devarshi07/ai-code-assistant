// Loaders for Campfire's nightly data exports.
//
// members.csv    one row per member: id,name,joined,interests
//                (joined is YYYY-MM-DD; interests are separated by ';')
// activity.log   one event per line, applied in order:
//
//     friend <a> <b>              a and b become friends
//     unfriend <a> <b>            a ends the friendship with b
//     block <blocker> <other>     blocker blocks other
//     unblock <blocker> <other>   blocker lifts the block
//     deactivate <member>         member closes their account
//
// Blank lines and lines starting with '#' are ignored.
const fs = require('node:fs');
const path = require('node:path');
const { SocialGraph, GraphError } = require('./graph');
const { User, ModelError, parseDate, parseInterests } = require('./models');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MEMBER_COLUMNS = ['id', 'name', 'joined', 'interests'];

// verb -> [number of member ids, graph method name]
const EVENTS = {
  friend: [2, 'addFriendship'],
  unfriend: [2, 'removeFriendship'],
  block: [2, 'block'],
  unblock: [2, 'unblock'],
  deactivate: [1, 'deactivate'],
};

/** A malformed export. The message names the file and line. */
class LoadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LoadError';
  }
}

/** Split one CSV line into fields, honouring double-quoted fields. */
function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { fields.push(field); field = ''; }
    else field += ch;
  }
  fields.push(field);
  return fields;
}

/** Add every member in a members.csv export to graph (or a new graph). */
function loadMembersCsv(text, graph = new SocialGraph(), source = 'members.csv') {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const header = parseCsvLine(lines[0] || '').map(name => name.trim());
  const missing = MEMBER_COLUMNS.filter(column => !header.includes(column));
  if (missing.length) throw new LoadError(`${source}: missing column(s) ${missing.join(', ')}`);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvLine(lines[i]);
    const field = {};
    for (const column of MEMBER_COLUMNS) field[column] = (values[header.indexOf(column)] || '').trim();
    try {
      graph.addUser(new User(field.id, field.name, parseDate(field.joined), parseInterests(field.interests)));
    } catch (error) {
      if (error instanceof ModelError || error instanceof GraphError) throw new LoadError(`${source} line ${i + 1}: ${error.message}`);
      throw error;
    }
  }
  return graph;
}

/** Apply an activity log to graph, in order. Returns a count of events by verb. */
function applyActivity(graph, text, source = 'activity.log') {
  const applied = {};
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const [verb, ...ids] = line.split(/\s+/);
    const number = index + 1;
    if (!Object.prototype.hasOwnProperty.call(EVENTS, verb)) throw new LoadError(`${source} line ${number}: unknown event '${verb}'`);
    const [arity, method] = EVENTS[verb];
    if (ids.length !== arity) throw new LoadError(`${source} line ${number}: ${verb} takes ${arity} member id(s), got ${ids.length}`);
    try {
      graph[method](...ids);
    } catch (error) {
      if (error instanceof GraphError) throw new LoadError(`${source} line ${number}: ${error.message}`);
      throw error;
    }
    applied[verb] = (applied[verb] || 0) + 1;
  });
  return applied;
}

/** Build a graph from a members export plus an activity log. */
function loadNetwork(membersText, activityText) {
  const graph = loadMembersCsv(membersText);
  applyActivity(graph, activityText);
  return graph;
}

/** The small sample network in data/, used by main.js and the tests. */
function loadSample() {
  const members = fs.readFileSync(path.join(DATA_DIR, 'members.csv'), 'utf8');
  const activity = fs.readFileSync(path.join(DATA_DIR, 'activity.log'), 'utf8');
  return loadNetwork(members, activity);
}

module.exports = { LoadError, parseCsvLine, loadMembersCsv, applyActivity, loadNetwork, loadSample };
