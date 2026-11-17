package oneofeach;

import java.util.List;

/**
 * A solver answer: the chosen words in alphabetical order, and the number of
 * letters they cover.
 */
public record Selection(List<String> words, int total) {}
