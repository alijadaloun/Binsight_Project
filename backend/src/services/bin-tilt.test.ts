import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isFallen } from './bin-tilt.js';

test('a bin tilted past the threshold, either way, has fallen', () => {
  assert.equal(isFallen(1.2, 45), false);
  assert.equal(isFallen(44.99, 45), false);
  assert.equal(isFallen(45, 45), true);
  assert.equal(isFallen(88, 45), true);
  assert.equal(isFallen(-90, 45), true);
  assert.equal(isFallen(178, 45), true);
});

test('a bin with no tilt reading is not reported as fallen', () => {
  assert.equal(isFallen(null, 45), false);
});
