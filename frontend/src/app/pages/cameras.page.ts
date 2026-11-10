import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, forkJoin, switchMap } from 'rxjs';
import { CameraService, DetectionEventService } from '../core/api.services';
import { RefreshService } from '../core/refresh.service';
import { Camera, DetectionEvent } from '../core/models';

@Component({
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-heading"><div><p class="eyebrow">VIDEO MONITORING</p><h1>Cameras</h1><p>Registered cameras and detection history</p></div><span class="refresh-note">Updated every {{ refresh.seconds() }} seconds</span></div>
    @if (loading()) { <div class="message">Loading monitoring data...</div> }
    @else if (error()) { <div class="message error">BinSight cannot be reached right now.</div> }
    @else if (!cameras().length) { <div class="message">No monitoring data available.</div> }
    @else {
      <div class="table-wrap"><table><thead><tr><th>Camera ID</th><th>Cluster</th><th>Location</th><th>Status</th><th>Last Event</th><th>Events</th></tr></thead><tbody>
        @for (camera of cameras(); track camera.cameraId) {
          <tr><td class="strong-cell">{{ camera.cameraId }}</td><td>{{ camera.clusterId }}</td><td>{{ camera.locationName ?? 'Unknown' }}</td><td><span class="status-tag unknown">{{ camera.status ?? 'Unknown' }}</span></td><td>{{ camera.lastEvent ? (camera.lastEvent | date:'d MMM yyyy, HH:mm') : 'None' }}</td><td><a [routerLink]="['/detection-events']" [queryParams]="{ camera: camera.cameraId }">{{ eventCount(camera.cameraId) }} events</a></td></tr>
        }
      </tbody></table></div>
    }
  `
})
export class CamerasPage {
  private readonly cameraService = inject(CameraService);
  private readonly eventService = inject(DetectionEventService);
  readonly refresh = inject(RefreshService);
  readonly cameras = signal<Camera[]>([]);
  readonly events = signal<DetectionEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    this.refresh.ticks$.pipe(switchMap(() => forkJoin({
      cameras: this.cameraService.list(), events: this.eventService.list()
    }).pipe(catchError(() => { this.error.set(true); this.loading.set(false); return EMPTY; }))),
    takeUntilDestroyed()).subscribe(({ cameras, events }) => {
      this.cameras.set(cameras); this.events.set(events); this.error.set(false); this.loading.set(false);
    });
  }

  eventCount(cameraId: string): number {
    return this.events().filter((event) => event.cameraId === cameraId).length;
  }
}
