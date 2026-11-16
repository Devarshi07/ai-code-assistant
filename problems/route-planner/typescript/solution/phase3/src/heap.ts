// A binary min-heap ordered by a comparison function.

export class MinHeap<T> {
  private readonly before: (a: T, b: T) => boolean;
  private readonly items: T[] = [];

  /** `before(a, b)` is true when a must come out before b. */
  constructor(before: (a: T, b: T) => boolean) {
    this.before = before;
  }

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
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

  /** Remove and return the first item. Call only when the heap is not empty. */
  pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
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
