export interface Camera {
  cameraId: string;
  clusterId: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  status: null;
  lastEvent: Date | null;
}
