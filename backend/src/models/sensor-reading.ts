export interface SensorReading {
  id: number;
  binId: string;
  fillLevelPercentage: number | null;
  gasLevel: number | null;
  tiltAngle: number | null;
  timestamp: Date;
}

export interface SensorReadingFilters {
  binId?: string;
  from?: Date;
  to?: Date;
}

export interface NewSensorReading {
  binId: string;
  fillLevelPercentage: number | null;
  gasLevel: number | null;
  tiltAngle: number | null;
  timestamp: Date;
}
