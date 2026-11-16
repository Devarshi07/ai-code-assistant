package armada;

/**
 * The outcome of one match.
 *
 * @param won     every ship sunk within the budget
 * @param repeats shots at cells that had already been fired at
 */
public record MatchReport(String bot, int shots, boolean won, int repeats, Battle battle) {
    public String summary() {
        String verdict = won ? "sank the fleet" : "did not sink the fleet";
        return bot + " " + verdict + " in " + shots + " shots (" + repeats + " repeated)";
    }
}
