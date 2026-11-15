// A binary min-heap ordered by a comparison function.

class MinHeap {
  /** @param {(a: any, b: any) => boolean} before true when a must come out before b */
  constructor(before) {
    this.before = before;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    const items = this.items;
    let index = items.length;
    items.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(item, items[parent])) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      let index = 0;
      for (;;) {
        let child = 2 * index + 1;
        if (child >= items.length) break;
        if (child + 1 < items.length && this.before(items[child + 1], items[child])) child++;
        if (!this.before(items[child], last)) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return top;
  }
}

module.exports = { MinHeap };
