import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyzeCollections } from './collection-analysis.js';

const now = new Date('2026-10-31T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
const bin = (binId: string, clusterId = 'C1') => ({ binId, clusterId, locationName: 'Amchit', readingStale: false });
const reading = (binId: string, fillLevelPercentage: number | null, hours: number) =>
  ({ binId, fillLevelPercentage, timestamp: hoursAgo(hours) });
let nextEventId = 1;
const truck = (eventType: string, hours: number, clusterId = 'C1') =>
  ({ eventId: nextEventId++, eventType, cameraId: 'CAM_1', clusterId, timestamp: hoursAgo(hours) });

test('confirms a stop when the bin empties and measures time since it became full', () => {
  const { records, summary } = analyzeCollections(
    [bin('B1')],
    [reading('B1', 40, 8), reading('B1', 75, 6), reading('B1', 85, 4), reading('B1', 5, 2.5)],
    [truck('GARBAGE_TRUCK_STOP', 3)],
    now, 6
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'CONFIRMED');
  assert.equal(records[0].fillBefore, 85);
  assert.equal(records[0].fillAfter, 5);
  assert.equal(records[0].responseMinutes, 180);
  assert.equal(summary.averageResponseMinutes, 180);
});

test('marks stops as incomplete or pending based on the next reading', () => {
  const { records } = analyzeCollections(
    [bin('B1'), bin('B2')],
    [reading('B1', 88, 3), reading('B1', 80, 1.5), reading('B2', 90, 3)],
    [truck('GARBAGE_TRUCK_STOP', 2)],
    now, 6
  );
  assert.deepEqual(records.map((record) => [record.binId, record.status]).sort(), [['B1', 'INCOMPLETE'], ['B2', 'PENDING']]);
});

test('reports a truck pass at a full bin as missed, but ignores bins below capacity', () => {
  const { records, summary } = analyzeCollections(
    [bin('B1'), bin('B2')],
    [reading('B1', 70, 5), reading('B2', 30, 5)],
    [truck('GARBAGE_TRUCK_PASS', 4), truck('GARBAGE_TRUCK_PASS', 3)],
    now, 6
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].binId, 'B1');
  assert.equal(summary.missed, 1);
  assert.equal(summary.averageResponseMinutes, null);
});

test('flags bins full past the limit with no stop as overdue', () => {
  const { records } = analyzeCollections(
    [bin('B1'), bin('B2', 'C2'), bin('B3', 'C3'), { ...bin('B4', 'C4'), readingStale: true }],
    [
      reading('B1', 75, 10), reading('B1', 92, 1),
      reading('B2', 70, 3),
      reading('B3', 90, 9), reading('B3', 95, 1),
      reading('B4', 99, 30)
    ],
    [truck('GARBAGE_TRUCK_STOP', 0.5, 'C3')],
    now, 6
  );
  const overdue = records.filter((record) => record.status === 'OVERDUE');
  assert.deepEqual(overdue.map((record) => record.binId), ['B1']);
  assert.equal(overdue[0].responseMinutes, 600);
});

test('ignores readings without a fill level and other event types', () => {
  const { records } = analyzeCollections(
    [bin('B1')],
    [reading('B1', 90, 4), reading('B1', null, 3), reading('B1', 10, 1)],
    [truck('GARBAGE_OUTSIDE_BIN', 3.5), truck('GARBAGE_TRUCK_STOP', 2)],
    now, 6
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'CONFIRMED');
});
