// Menu items and the stations of the kitchen line.
//
// Every dish is cooked start to finish by one cook at exactly one station.
// Prep times are whole minutes of hands-on cooking time.

/** Thrown when a ticket names a dish the kitchen does not make. */
class MenuError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MenuError';
  }
}

class MenuItem {
  constructor(name, station, prep) {
    if (!Number.isInteger(prep) || prep < 1) throw new Error(`${name}: prep time must be at least one minute`);
    this.name = name;
    this.station = station;
    this.prep = prep; // minutes
  }
}

class Station {
  constructor(name, cooks) {
    if (!Number.isInteger(cooks) || cooks < 1) throw new Error(`station ${name} needs at least one cook`);
    this.name = name;
    this.cooks = cooks; // identical cooks working this station side by side
  }
}

/** Dish lookup by name. Names are matched case-insensitively. */
class Menu {
  constructor(items) {
    this._items = new Map();
    for (const item of items) {
      const key = item.name.toLowerCase();
      if (this._items.has(key)) throw new Error(`duplicate menu item "${item.name}"`);
      this._items.set(key, item);
    }
  }

  /** Read the menu sheet: one "<dish name>  <station>  <prep> min" per line. */
  static parse(text) {
    const items = [];
    text.split('\n').forEach((raw, index) => {
      const line = raw.split('#')[0].trim();
      if (!line) return;
      const match = /^(.*\S)\s+(\S+)\s+(\d+)\s+min$/.exec(line);
      if (!match) throw new Error(`menu line ${index + 1}: expected "<dish> <station> <minutes> min"`);
      items.push(new MenuItem(match[1], match[2], Number(match[3])));
    });
    return new Menu(items);
  }

  get(name) {
    const item = this._items.get(String(name).toLowerCase());
    if (!item) throw new MenuError(`"${name}" is not on the menu`);
    return item;
  }

  has(name) {
    return this._items.has(String(name).toLowerCase());
  }

  get size() {
    return this._items.size;
  }

  [Symbol.iterator]() {
    return this._items.values();
  }
}

const HOUSE_MENU = Menu.parse(`
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
`);

// The lunch crew: two cooks on the grill, one everywhere else.
const HOUSE_LINE = [new Station('grill', 2), new Station('fryer', 1), new Station('salad', 1), new Station('oven', 1)];

module.exports = { MenuError, MenuItem, Station, Menu, HOUSE_MENU, HOUSE_LINE };
