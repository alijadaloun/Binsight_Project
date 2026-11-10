import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateStatus, storedBinStatus } from './thresholds.js';
import { parseThingSpeakFeeds } from './thingspeak.js';

const channel = {
  channel: { id: 3571750, field1: 'Fill Level Percentage', field2: 'Gas level', field3: 'Tilt angle' },
  feeds: [
    { created_at: '2026-11-09T10:53:42Z', entry_id: 1, field1: '72.5', field2: '115.2', field3: '3.4' },
    { created_at: '2026-11-09T11:00:18Z', entry_id: 3, field1: '62.5', field2: '135.2', field3: '4.4' },
    { created_at: '2026-11-09T11:00:40Z', entry_id: 4, field1: null, field2: null, field3: null },
    { created_at: '2026-11-09T11:00:50Z', entry_id: 5, field1: '150', field2: '10', field3: '1' },
    { created_at: '2026-11-09T10:59:48Z', entry_id: 2, field1: '72.5', field2: '115.2', field3: '3.4' }
  ]
};

test('reads fill, gas, and tilt from ThingSpeak fields and skips empty updates', () => {
  const readings = parseThingSpeakFeeds(channel);
  assert.deepEqual(readings.map((reading) => reading.entryId), [1, 2, 3]);
  assert.deepEqual(
    readings.map((reading) => [reading.fillLevelPercentage, reading.gasLevel, reading.tiltAngle]),
    [[72.5, 115.2, 3.4], [72.5, 115.2, 3.4], [62.5, 135.2, 4.4]]
  );
  assert.equal(readings[2].timestamp.toISOString(), '2026-11-09T11:00:18.000Z');
});

test('rejects a payload that is not a ThingSpeak feed list', () => {
  assert.throws(() => parseThingSpeakFeeds({}), /feeds list/);
});

test('fill at 70% or more is full, and tilt at the limit is a fallen bin', () => {
  assert.equal(calculateStatus(62.5), 'NORMAL');
  assert.equal(calculateStatus(69.99), 'NORMAL');
  assert.equal(calculateStatus(70), 'WARNING');
  assert.equal(calculateStatus(90), 'NEEDS_COLLECTION');
  assert.equal(calculateStatus(96), 'CRITICAL');
  assert.equal(storedBinStatus(62.5, 4.4), 'NORMAL');
  assert.equal(storedBinStatus(72.5, 3.4), 'FULL');
  assert.equal(storedBinStatus(10, 45), 'FALLEN');
  assert.equal(storedBinStatus(80, -50), 'FALLEN');
});
