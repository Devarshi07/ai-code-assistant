// Plain-text views used by the CLI and the support desk.
import type { SocialGraph } from './graph.ts';
import type { Suggestion } from './recommend.ts';

export function plural(count: number, noun: string): string {
  return count === 1 ? `${count} ${noun}` : `${count} ${noun}s`;
}

/** '18 members (1 deactivated), 32 friendships, 3 blocks'. */
export function networkSummary(graph: SocialGraph): string {
  const members = graph.users();
  const inactive = members.filter(user => !user.active).length;
  return `${plural(members.length, 'member')} (${inactive} deactivated), ` +
    `${plural(graph.friendshipCount(), 'friendship')}, ${plural(graph.blockCount(), 'block')}`;
}

/** 'Alice Moreno (@alice) has 2 friends: Carol Lindqvist, Erin Walsh'. */
export function friendList(graph: SocialGraph, userId: string): string {
  const user = graph.user(userId);
  const names = [...graph.friendsOf(userId)].map(id => graph.user(id).name).sort();
  const listing = names.length ? names.join(', ') : 'nobody yet';
  return `${user} has ${plural(names.length, 'friend')}: ${listing}`;
}

/** How userId's profile looks to viewerId. */
export function profileCard(graph: SocialGraph, viewerId: string, userId: string): string {
  const user = graph.user(userId);
  const lines = [String(user), `  member since ${user.memberSince}`];
  if (user.interests.size) lines.push('  into ' + [...user.interests].sort().join(', '));
  lines.push('  ' + plural(graph.friendCount(userId), 'friend'));
  if (viewerId !== userId) {
    const mutual = graph.mutualFriends(viewerId, userId);
    if (mutual.length) {
      const names = mutual.map(id => graph.user(id).firstName).join(', ');
      lines.push(`  ${plural(mutual.length, 'mutual friend')} with ${graph.user(viewerId).firstName}: ${names}`);
    }
  }
  if (!user.active) lines.push('  (account deactivated)');
  return lines.join('\n');
}

/** The 'People you may know' panel as text. */
export function suggestionLines(graph: SocialGraph, userId: string, suggestions: Suggestion[]): string {
  const title = `People ${graph.user(userId).firstName} may know:`;
  if (!suggestions.length) return `${title} no suggestions yet`;
  const lines = [title];
  suggestions.forEach((suggestion, index) => {
    const other = graph.user(suggestion.userId);
    lines.push(`  ${index + 1}. ${other}  ${plural(suggestion.mutual, 'mutual friend')}, ${plural(suggestion.shared, 'shared interest')}`);
  });
  return lines.join('\n');
}
