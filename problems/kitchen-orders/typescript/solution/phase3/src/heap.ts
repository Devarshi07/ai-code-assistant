// Binary min-heap ordered by a "comes first" predicate.

export class Heap<T> {
  private before: (a: T, b: T) => boolean;
  private items: T[] = [];

  /** @param before  true when a should pop before b */
  constructor(before: (a: T, b: T) => boolean) {
    this.before = before;
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T {
    return this.items[0];
  }

  push(value: T): void {
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

  pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop() as T;
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
