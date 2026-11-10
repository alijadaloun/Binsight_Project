export type ComputedBinStatus = 'NORMAL' | 'WARNING' | 'NEEDS_COLLECTION' | 'CRITICAL';

export interface BinCluster {
  clusterId: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Bin extends BinCluster {
  binId: string;
  status: string | null;
  computedStatus: ComputedBinStatus | null;
  readingStale: boolean;
  fallen: boolean;
  fillLevelPercentage: number | null;
  gasLevel: number | null;
  tiltAngle: number | null;
  lastUpdated: string | null;
}

export interface SensorReading {
  id: number;
  binId: string;
  fillLevelPercentage: number | null;
  gasLevel: number | null;
  tiltAngle: number | null;
  timestamp: string;
}

export interface Camera extends BinCluster {
  cameraId: string;
  status: string | null;
  lastEvent: string | null;
}

export interface DetectionEvent extends BinCluster {
  eventId: number;
  eventType: 'GARBAGE_OUTSIDE_BIN' | 'GARBAGE_TRUCK_PASS' | 'GARBAGE_TRUCK_STOP';
  confidence: number | null;
  timestamp: string;
  snapshot: string | null;
  cameraId: string;
}

export type CollectionStatus = 'CONFIRMED' | 'INCOMPLETE' | 'PENDING' | 'MISSED' | 'OVERDUE';

export interface CollectionRecord {
  status: CollectionStatus;
  binId: string;
  clusterId: string;
  locationName: string | null;
  eventId: number | null;
  cameraId: string | null;
  fullSince: string;
  truckAt: string | null;
  fillBefore: number;
  fillAfter: number | null;
  responseMinutes: number | null;
}

export interface CollectionAnalysis {
  summary: { confirmed: number; incomplete: number; pending: number; missed: number; overdue: number; averageResponseMinutes: number | null };
  records: CollectionRecord[];
}

export interface DashboardSummary {
  totalBins: number;
  normalBins: number;
  warningBins: number;
  needsCollectionBins: number;
  criticalBins: number;
  staleBins: number;
  fallenBins: number;
  totalAiEvents: number;
  activeAiEvents: number | null;
  totalCameras: number;
  onlineCameras: number | null;
  lastUpdated: string | null;
  fullFillPercentage: number;
  fallenTiltDegrees: number;
}
