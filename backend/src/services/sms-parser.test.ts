import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSmsReadings } from './sms-parser.js';

test('parses one or more complete bin readings', () => {
  const readings = parseSmsReadings(
    'BIN_001,96,7.25,0,2026-09-30T12:00:00Z\nBIN_002,48,2.5,-1,2026-09-30T12:00:00Z'
  );
  assert.equal(readings.length, 2);
  assert.deepEqual(readings.map((reading) => reading.binId), ['BIN_001', 'BIN_002']);
  assert.equal(readings[0].fillLevelPercentage, 96);
  assert.equal(readings[0].gasLevel, 7.25);
  assert.equal(readings[1].tiltAngle, -1);
  assert.equal(readings[0].timestamp.toISOString(), '2026-09-30T12:00:00.000Z');
});

test('rejects incomplete, repeated, and invalid readings', () => {
  for (const sms of [
    '',
    'BIN_001,96,7.25,2026-09-30T12:00:00Z',
    'BIN_001,101,7.25,0,2026-09-30T12:00:00Z',
    'BIN_001,,7.25,0,2026-09-30T12:00:00Z',
    'BIN_001,96,7.25,0,2026-02-30 12:00:00',
    'BIN_001,96,7.25,0,2026-09-30T12:00:00Z\nBIN_001,97,7.25,0,2026-09-30T12:00:00Z'
  ]) {
    assert.throws(() => parseSmsReadings(sms), sms);
  }
});
