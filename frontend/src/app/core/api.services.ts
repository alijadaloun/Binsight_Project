import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Bin, Camera, CollectionAnalysis, DashboardSummary, DetectionEvent, SensorReading } from './models';

@Injectable({ providedIn: 'root' })
export class BinService {
  private readonly http = inject(HttpClient);

  list(): Observable<Bin[]> { return this.http.get<Bin[]>('/api/bins'); }
  get(id: string): Observable<Bin> { return this.http.get<Bin>(`/api/bins/${encodeURIComponent(id)}`); }
  readings(id: string): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(`/api/bins/${encodeURIComponent(id)}/readings`);
  }
}

@Injectable({ providedIn: 'root' })
export class SensorService {
  private readonly http = inject(HttpClient);

  list(filters: { binId?: string; from?: string; to?: string } = {}): Observable<SensorReading[]> {
    let params = new HttpParams();
    if (filters.binId) params = params.set('bin_id', filters.binId);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http.get<SensorReading[]>('/api/sensor-readings', { params });
  }
}

@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly http = inject(HttpClient);
  list(): Observable<Camera[]> { return this.http.get<Camera[]>('/api/cameras'); }
}

@Injectable({ providedIn: 'root' })
export class DetectionEventService {
  private readonly http = inject(HttpClient);
  list(): Observable<DetectionEvent[]> { return this.http.get<DetectionEvent[]>('/api/detection-events'); }
  get(id: number): Observable<DetectionEvent> { return this.http.get<DetectionEvent>(`/api/detection-events/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly http = inject(HttpClient);
  list(): Observable<CollectionAnalysis> { return this.http.get<CollectionAnalysis>('/api/collections'); }
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  summary(): Observable<DashboardSummary> { return this.http.get<DashboardSummary>('/api/dashboard/summary'); }
}
