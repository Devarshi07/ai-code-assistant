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
import { readFileSync } from 'node:fs';
import { GraphError, SocialGraph } from './graph.ts';
import { ModelError, User, parseDate, parseInterests } from './models.ts';

const DATA_DIR = new URL('../data/', import.meta.url);
const MEMBER_COLUMNS = ['id', 'name', 'joined', 'interests'] as const;
type MemberColumn = (typeof MEMBER_COLUMNS)[number];

interface EventSpec {
  arity: number; // how many member ids the event takes
  apply: (graph: SocialGraph, ids: string[]) => unknown;
}

const EVENTS: Record<string, EventSpec> = {
  friend: { arity: 2, apply: (graph, [a, b]) => graph.addFriendship(a, b) },
  unfriend: { arity: 2, apply: (graph, [a, b]) => graph.removeFriendship(a, b) },
  block: { arity: 2, apply: (graph, [blocker, blocked]) => graph.block(blocker, blocked) },
  unblock: { arity: 2, apply: (graph, [blocker, blocked]) => graph.unblock(blocker, blocked) },
  deactivate: { arity: 1, apply: (graph, [member]) => graph.deactivate(member) },
};

/** A malformed export. The message names the file and line. */
export class LoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoadError';
  }
}

/** Split one CSV line into fields, honouring double-quoted fields. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
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
export function loadMembersCsv(text: string, graph = new SocialGraph(), source = 'members.csv'): SocialGraph {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const header = parseCsvLine(lines[0] ?? '').map(name => name.trim());
  const missing = MEMBER_COLUMNS.filter(column => !header.includes(column));
  if (missing.length) throw new LoadError(`${source}: missing column(s) ${missing.join(', ')}`);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvLine(lines[i]);
    const field = (column: MemberColumn): string => (values[header.indexOf(column)] ?? '').trim();
    try {
      graph.addUser(new User(field('id'), field('name'), parseDate(field('joined')), parseInterests(field('interests'))));
    } catch (error) {
      if (error instanceof ModelError || error instanceof GraphError) throw new LoadError(`${source} line ${i + 1}: ${error.message}`);
      throw error;
    }
  }
  return graph;
}

/** Apply an activity log to graph, in order. Returns a count of events by verb. */
export function applyActivity(graph: SocialGraph, text: string, source = 'activity.log'): Record<string, number> {
  const applied: Record<string, number> = {};
  for (const [index, raw] of text.split('\n').entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [verb, ...ids] = line.split(/\s+/);
    const number = index + 1;
    if (!Object.hasOwn(EVENTS, verb)) throw new LoadError(`${source} line ${number}: unknown event '${verb}'`);
    const { arity, apply } = EVENTS[verb];
    if (ids.length !== arity) throw new LoadError(`${source} line ${number}: ${verb} takes ${arity} member id(s), got ${ids.length}`);
    try {
      apply(graph, ids);
    } catch (error) {
      if (error instanceof GraphError) throw new LoadError(`${source} line ${number}: ${error.message}`);
      throw error;
    }
    applied[verb] = (applied[verb] ?? 0) + 1;
  }
  return applied;
}

/** Build a graph from a members export plus an activity log. */
export function loadNetwork(membersText: string, activityText: string): SocialGraph {
  const graph = loadMembersCsv(membersText);
  applyActivity(graph, activityText);
  return graph;
}

/** The small sample network in data/, used by main.ts and the tests. */
export function loadSample(): SocialGraph {
  const members = readFileSync(new URL('members.csv', DATA_DIR), 'utf8');
  const activity = readFileSync(new URL('activity.log', DATA_DIR), 'utf8');
  return loadNetwork(members, activity);
}
