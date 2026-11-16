package campfire;

/**
 * One entry of the "People you may know" panel.
 *
 * @param userId the suggested member
 * @param mutual active friends the two members have in common
 * @param shared interests the two members have in common
 */
public record Suggestion(String userId, int mutual, int shared) {}
