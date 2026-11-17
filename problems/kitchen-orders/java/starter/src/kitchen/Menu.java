package kitchen;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Dish lookup by name. Names are matched case-insensitively. */
public final class Menu {
    private static final Pattern MENU_LINE = Pattern.compile("^(.*\\S)\\s+(\\S+)\\s+(\\d+)\\s+min$");

    private final Map<String, MenuItem> items = new LinkedHashMap<>();

    public Menu(List<MenuItem> items) {
        for (MenuItem item : items) {
            String key = item.name().toLowerCase(Locale.ROOT);
            if (this.items.containsKey(key)) throw new IllegalArgumentException("duplicate menu item \"" + item.name() + "\"");
            this.items.put(key, item);
        }
    }

    /** Read the menu sheet: one "&lt;dish name&gt;  &lt;station&gt;  &lt;prep&gt; min" per line. */
    public static Menu parse(String text) {
        List<MenuItem> items = new ArrayList<>();
        String[] lines = text.split("\n", -1);
        for (int index = 0; index < lines.length; index++) {
            String line = lines[index].split("#", -1)[0].trim();
            if (line.isEmpty()) continue;
            Matcher match = MENU_LINE.matcher(line);
            if (!match.matches()) {
                throw new IllegalArgumentException("menu line " + (index + 1) + ": expected \"<dish> <station> <minutes> min\"");
            }
            items.add(new MenuItem(match.group(1), match.group(2), Integer.parseInt(match.group(3))));
        }
        return new Menu(items);
    }

    public MenuItem get(String name) {
        MenuItem item = items.get(String.valueOf(name).toLowerCase(Locale.ROOT));
        if (item == null) throw new MenuException("\"" + name + "\" is not on the menu");
        return item;
    }

    public boolean has(String name) {
        return items.containsKey(String.valueOf(name).toLowerCase(Locale.ROOT));
    }

    public int size() {
        return items.size();
    }

    public Collection<MenuItem> items() {
        return items.values();
    }

    public static final Menu HOUSE_MENU = parse("""
            # dish              station  prep
            burger              grill     7 min
            cheeseburger        grill     8 min
            chicken sandwich    grill     6 min
            steak frites        grill    14 min
            fries               fryer     4 min
            onion rings         fryer     5 min
            wings               fryer     9 min
            fish and chips      fryer     8 min
            house salad         salad     3 min
            caesar salad        salad     4 min
            tomato soup         salad     2 min   # the salad station also ladles soup
            margherita          oven      9 min
            flatbread           oven      6 min
            brownie             oven      3 min
            """);

    /** The lunch crew: two cooks on the grill, one everywhere else. */
    public static final List<Station> HOUSE_LINE = List.of(
            new Station("grill", 2), new Station("fryer", 1), new Station("salad", 1), new Station("oven", 1));
}
