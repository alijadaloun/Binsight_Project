import { Bin } from '../models/bin.js';
import { findAllBins, findBinById } from '../repositories/bin.repository.js';
import { isFallen } from './bin-tilt.js';
import { calculateStatus, fallenTiltDegrees } from './thresholds.js';

export { calculateStatus } from './thresholds.js';

const staleAfterMinutes = Number(process.env.DATA_STALE_AFTER_MINUTES ?? 1440);
if (!Number.isFinite(staleAfterMinutes) || staleAfterMinutes <= 0) {
  throw new Error('DATA_STALE_AFTER_MINUTES must be a positive number.');
}

export function isReadingStale(lastUpdated: Date | null, now = new Date()): boolean {
  return lastUpdated !== null &&
    (now.getTime() - lastUpdated.getTime() > staleAfterMinutes * 60_000 ||
     lastUpdated.getTime() - now.getTime() > 5 * 60_000);
}

export async function getBins(): Promise<Bin[]> {
  const bins = await findAllBins();
  const now = new Date();

  return bins.map((bin) => withStatus(bin, now));
}

export async function getBin(binId: string): Promise<Bin | null> {
  const bin = await findBinById(binId);
  return bin ? withStatus(bin, new Date()) : null;
}

// A fallen bin stays flagged even once its readings go stale: the last thing it reported
// is that it fell, and a damaged node may stop reporting altogether.
function withStatus(bin: Omit<Bin, 'computedStatus' | 'readingStale' | 'fallen'>, now: Date): Bin {
  const readingStale = isReadingStale(bin.lastUpdated, now);
  return {
    ...bin,
    readingStale,
    fallen: isFallen(bin.tiltAngle, fallenTiltDegrees),
    computedStatus: calculateStatus(bin.fillLevelPercentage)
  };
}
