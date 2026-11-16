package armada;

import java.util.List;

/** Fires a fixed list of shots in order. QA uses it to replay bug reports. */
public final class ScriptedBot extends Bot {
    private final List<Coord> script;
    private int cursor;

    public ScriptedBot(int size, List<Coord> shots) {
        super(size, Fleet.DEFAULT_FLEET);
        this.script = List.copyOf(shots);
    }

    /** A bot that replays labelled shots such as "B7". */
    public static ScriptedBot fromLabels(int size, List<String> labels) {
        return new ScriptedBot(size, labels.stream().map(Coord::parse).toList());
    }

    @Override
    public Coord nextShot() {
        if (cursor >= script.size()) throw new BotException("script exhausted after " + script.size() + " shots");
        cursor += 1;
        return script.get(cursor - 1);
    }
}
