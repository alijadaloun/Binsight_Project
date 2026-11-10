import type { RowDataPacket } from 'mysql2';

import { databasePool } from '../config/database.js';
import { getBins } from './bin.service.js';
import { fallenTiltDegrees, fullFillPercentage } from './thresholds.js';

interface DashboardSummary {
  totalBins: number;
  normalBins: number;
  warningBins: number;
  needsCollectionBins: number;
  criticalBins: number;
  staleBins: number;
  fallenBins: number;
  totalAiEvents: number;
  activeAiEvents: null;
  totalCameras: number;
  onlineCameras: null;
  lastUpdated: Date | null;
  fullFillPercentage: number;
  fallenTiltDegrees: number;
}

interface SummaryRow extends RowDataPacket {
  totalAiEvents: number;
  totalCameras: number;
  lastUpdated: Date | null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [bins, [summaryRows]] = await Promise.all([
    getBins(),
    databasePool.query<SummaryRow[]>(`
      SELECT (SELECT COUNT(*) FROM detection_events) AS totalAiEvents,
             (SELECT COUNT(*) FROM cameras) AS totalCameras,
             (SELECT MAX(recent.timestamp) FROM (
               SELECT MAX(timestamp) AS timestamp FROM sensor_readings
               UNION ALL
               SELECT MAX(timestamp) AS timestamp FROM detection_events
             ) recent) AS lastUpdated
    `)
  ]);

  const counts = { NORMAL: 0, WARNING: 0, NEEDS_COLLECTION: 0, CRITICAL: 0 };
  for (const bin of bins) {
    if (bin.computedStatus) counts[bin.computedStatus] += 1;
  }

  return {
    totalBins: bins.length,
    normalBins: counts.NORMAL,
    warningBins: counts.WARNING,
    needsCollectionBins: counts.NEEDS_COLLECTION,
    criticalBins: counts.CRITICAL,
    staleBins: bins.filter((bin) => bin.readingStale).length,
    fallenBins: bins.filter((bin) => bin.fallen).length,
    totalAiEvents: summaryRows[0].totalAiEvents,
    activeAiEvents: null,
    totalCameras: summaryRows[0].totalCameras,
    onlineCameras: null,
    lastUpdated: summaryRows[0].lastUpdated,
    fullFillPercentage,
    fallenTiltDegrees
  };
}
