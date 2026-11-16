package maze;

import java.util.List;

/**
 * A complete route through a level.
 *
 * @param path every tile visited, start and exit inclusive
 * @param moves the number of steps, always {@code path.size() - 1}
 */
public record Run(List<Position> path, int moves) {}
