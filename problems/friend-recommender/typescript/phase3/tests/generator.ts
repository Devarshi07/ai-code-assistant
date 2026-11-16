// Seeded generator for large Campfire-like networks.
//
// Members belong to clubs of `club` consecutive ids and make most of their
// friends inside their club, so friends of friends overlap the way they do in
// real communities. A few organisers have hundreds of friends across the whole
// network. The generator uses a Park-Miller random number generator so the
// copies of this file in the other languages build exactly the same network.
import { SocialGraph } from '../src/graph.ts';
import { User } from '../src/models.ts';

const TAGS = ['climbing', 'jazz', 'film', 'cooking', 'cycling', 'photography', 'board-games',
  'running', 'chess', 'gardening', 'poetry', 'baking', 'hiking', 'anime', 'knitting',
  'surfing', 'podcasts', 'yoga', 'sci-fi', 'vinyl', 'pottery', 'birding', 'coding', 'dance'];

/** Returns below(n), a pseudo-random integer in [0, n). */
function rng(seed: number): (n: number) => number {
  let state = seed % 2147483647 || 1;
  return n => {
    state = (state * 48271) % 2147483647; // exact: the product stays below 2^53
    return state % n;
  };
}

export const memberId = (index: number): string => `m${String(index).padStart(5, '0')}`;

export interface NetworkOptions {
  friends?: number;    // friend picks per member
  club?: number;       // members per club
  localPct?: number;   // percent of picks made inside the member's club
  organisers?: number; // members who befriend people all over the network
  reach?: number;      // friend picks per organiser
  blocks?: number;     // block attempts between friends of friends
  inactive?: number;   // deactivation picks
}

export function buildNetwork(seed: number, size: number,
  { friends = 7, club = 50, localPct = 85, organisers = 0, reach = 0, blocks = 0, inactive = 0 }: NetworkOptions = {}): SocialGraph {
  const below = rng(seed);
  const graph = new SocialGraph();
  for (let i = 0; i < size; i++) {
    const tags: string[] = [];
    for (let t = 0; t < 3; t++) tags.push(TAGS[below(TAGS.length)]);
    graph.addUser(new User(memberId(i), `Member ${i}`, '2021-01-01', tags));
  }

  const links: number[][] = Array.from({ length: size }, () => []);
  const link = (a: number, b: number): void => {
    if (a !== b && graph.addFriendship(memberId(a), memberId(b))) {
      links[a].push(b);
      links[b].push(a);
    }
  };

  for (let i = 0; i < size; i++) {
    const start = i - (i % club);
    const span = Math.min(club, size - start);
    for (let f = 0; f < friends; f++) {
      if (below(100) < localPct) link(i, start + below(span));
      else link(i, below(size));
    }
  }
  for (let h = 0; h < organisers; h++) {
    const hub = below(size);
    for (let r = 0; r < reach; r++) link(hub, below(size));
  }
  for (let b = 0; b < blocks; b++) {
    const a = below(size);
    if (!links[a].length) continue;
    const via = links[a][below(links[a].length)];
    const c = links[via][below(links[via].length)];
    if (c !== a) {
      if (below(2)) graph.block(memberId(a), memberId(c));
      else graph.block(memberId(c), memberId(a));
    }
  }
  for (let d = 0; d < inactive; d++) graph.deactivate(memberId(below(size)));
  return graph;
}
