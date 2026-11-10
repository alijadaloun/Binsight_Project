export interface DetectionEvent {
  eventId: number;
  eventType: string;
  confidence: number | null;
  timestamp: Date;
  snapshot: string | null;
  cameraId: string;
  clusterId: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface NewDetectionEvent {
  cameraId: string;
  eventType: string;
  confidence: number | null;
  timestamp: Date;
  snapshot: string | null;
}
