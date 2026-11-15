// Binary min-heap ordered by a "comes first" predicate.

class Heap {
  /** @param {(a: any, b: any) => boolean} before  true when a should pop before b */
  constructor(before) {
    this.before = before;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(value) {
    const items = this.items;
    let index = items.length;
    items.push(value);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(value, items[parent])) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = value;
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0) return top;
    let index = 0;
    const length = items.length;
    for (;;) {
      let child = 2 * index + 1;
      if (child >= length) break;
      if (child + 1 < length && this.before(items[child + 1], items[child])) child += 1;
      if (!this.before(items[child], last)) break;
      items[index] = items[child];
      index = child;
    }
    items[index] = last;
    return top;
  }
}

module.exports = { Heap };
