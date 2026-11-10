export type ComputedBinStatus = 'NORMAL' | 'WARNING' | 'NEEDS_COLLECTION' | 'CRITICAL';

export interface Bin {
  binId: string;
  status: string | null;
  computedStatus: ComputedBinStatus | null;
  readingStale: boolean;
  fallen: boolean;
  clusterId: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  fillLevelPercentage: number | null;
  gasLevel: number | null;
  tiltAngle: number | null;
  lastUpdated: Date | null;
}
