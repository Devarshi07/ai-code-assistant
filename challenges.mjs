export const challenges = [{
  id:'python-cart',title:'Checkout totals under pressure',category:'Python · Logic',minutes:25,
  featureBrief:'Add an optional maximum_discount argument to total. When provided, the monetary discount must not exceed that cap. Preserve existing callers, return cents correctly, reject a negative cap, and add tests for uncapped, capped, zero-cap and empty baskets. Keep discount-policy decisions separate from summing line items, using a small function rather than unnecessary class hierarchies.',
  brief:'A pricing service crashes for an empty basket and drops cents after discounts. Fix total(items, discount), preserve its API, and add regression tests. Items contain price and quantity; discount is a fraction from 0 to 1. Discuss how a discount policy could be separated from calculation.',
  files:{
    'pricing.py':'from functools import reduce\n\ndef total(items, discount=0):\n    subtotal = reduce(lambda a, b: a + b, [i["price"] * i["quantity"] for i in items])\n    return round(subtotal * (1 - discount))\n',
    'test_pricing.py':'import unittest\nfrom pricing import total\n\nclass PricingTests(unittest.TestCase):\n    def test_basic(self):\n        self.assertEqual(total([{"price": 10, "quantity": 2}]), 20)\n    def test_empty(self):\n        self.assertEqual(total([]), 0)\n    def test_discount(self):\n        self.assertEqual(total([{"price": 12.50, "quantity": 1}], .1), 11.25)\n\nif __name__ == "__main__":\n    unittest.main()\n',
    'README.md':'# Pricing service\n\nRun python -m unittest discover -v. Repair the existing behavior before extending it. Avoid rounding until the final total.\n'
  }
},{
  id: 'cart', title: 'The disappearing discount', category: 'JavaScript · Logic', minutes: 25,
  featureBrief:'Add an optional third argument maxDiscount to total. Cap the monetary discount when provided. Preserve existing callers, round only the final total, reject a negative cap, and test uncapped, capped, zero-cap and empty carts. Separate discount-policy logic from summing line items; explain why that boundary helps future policies and tests.',
  brief: 'A checkout service is charging the wrong totals. Customers report that discounts disappear and empty carts sometimes crash. Find the causes, fix the implementation, and get all tests passing. Keep the public API unchanged.',
  files: {
    'cart.mjs': `export function total(items, discount = 0) {\n  const subtotal = items.map(item => item.price * item.quantity)\n    .reduce((sum, value) => sum + value);\n  return Math.round(subtotal * (1 - discount)) * 100 / 100;\n}\n`,
    'cart.test.mjs': `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { total } from './cart.mjs';\ntest('adds line items', () => assert.equal(total([{price: 10, quantity: 2}]), 20));\ntest('empty cart', () => assert.equal(total([]), 0));\ntest('preserves cents', () => assert.equal(total([{price: 12.50, quantity: 1}], 0.1), 11.25));\ntest('rounds to cents', () => assert.equal(total([{price: 9.99, quantity: 3}], 0.15), 25.47));\n`,
    'README.md': '# Checkout incident\n\nFix cart.mjs without changing the API or tests. discount is a fraction between 0 and 1. Return totals rounded to two decimal places.\n'
  }
}, {
  id: 'cache', title: 'A cache that never forgets', category: 'JavaScript · State', minutes: 30,
  featureBrief:'Add size() to return the number of unexpired entries and remove expired entries while counting. Preserve cached falsy values, count entries expiring exactly now as expired, and retain the existing get/set API. Add deterministic tests using the injected clock. Extract a shared expiration check to avoid duplicating rules between get and size; explain its responsibility and testing boundary.',
  brief: 'An in-memory cache serves expired values and loses valid falsy values. Repair expiration and retrieval behavior. The clock is injected to make tests deterministic.',
  files: {
    'cache.mjs': `export class Cache {\n  constructor(now = Date.now) { this.now = now; this.entries = new Map(); }\n  set(key, value, ttl) { this.entries.set(key, {value, expires: this.now() + ttl}); }\n  get(key) {\n    const entry = this.entries.get(key);\n    if (!entry || !entry.value) return undefined;\n    if (entry.expires < this.now) this.entries.delete(key);\n    return entry.value;\n  }\n}\n`,
    'cache.test.mjs': `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { Cache } from './cache.mjs';\ntest('reads valid value', () => { const c = new Cache(() => 0); c.set('x', 'ok', 10); assert.equal(c.get('x'), 'ok'); });\ntest('preserves zero', () => { const c = new Cache(() => 0); c.set('x', 0, 10); assert.equal(c.get('x'), 0); });\ntest('expires at boundary', () => { let now = 0; const c = new Cache(() => now); c.set('x', 42, 10); now = 10; assert.equal(c.get('x'), undefined); });\ntest('expires after boundary', () => { let now = 0; const c = new Cache(() => now); c.set('x', 42, 10); now = 11; assert.equal(c.get('x'), undefined); });\n`,
    'README.md': '# Cache incident\n\nFix cache.mjs. TTL is in milliseconds; an entry expires at its expiry timestamp. All JavaScript values must be supported.\n'
  }
}];
