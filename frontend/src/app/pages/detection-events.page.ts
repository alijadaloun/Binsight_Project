import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { DetectionEventService } from '../core/api.services';
import { RefreshService } from '../core/refresh.service';
import { DetectionEvent } from '../core/models';

@Component({
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-heading"><div><p class="eyebrow">CAMERAS</p><h1>Camera alerts</h1><p>What the cameras noticed</p></div><span class="refresh-note">Updated every {{ refresh.seconds() }} seconds</span></div>
    @if (loading()) { <div class="message">Loading monitoring data...</div> }
    @else if (error()) { <div class="message error">BinSight cannot be reached right now.</div> }
    @else {
      <div class="toolbar">
        <label><span>Event type</span><select [ngModel]="type()" (ngModelChange)="type.set($event)"><option value="">All types</option><option value="GARBAGE_OUTSIDE_BIN">Garbage outside bin</option><option value="GARBAGE_TRUCK_PASS">Truck pass</option><option value="GARBAGE_TRUCK_STOP">Truck stop</option></select></label>
        <label><span>Camera</span><select [ngModel]="camera()" (ngModelChange)="camera.set($event)"><option value="">All cameras</option>@for (id of cameras(); track id) { <option [value]="id">{{ id }}</option> }</select></label>
        <label><span>Date</span><input type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" /></label>
        <label><span>Min. confidence</span><input type="number" min="0" max="100" step="1" [ngModel]="confidence()" (ngModelChange)="confidence.set($event)" /></label>
        <span class="result-count">{{ visible().length }} events</span>
      </div>
      @if (!events().length) { <div class="message">No monitoring data available.</div> }
      @else { <div class="table-wrap"><table><thead><tr><th>Event</th><th>Camera</th><th>Location</th><th>Confidence</th><th>Timestamp</th><th>Snapshot</th></tr></thead><tbody>
        @for (event of visible(); track event.eventId) {
          <tr><td class="strong-cell">{{ event.eventType.replaceAll('_', ' ') }}</td><td>{{ event.cameraId }}</td><td>{{ event.locationName ?? 'Unknown' }}</td><td>{{ event.confidence === null ? 'Unavailable' : (event.confidence * 100 | number:'1.0-0') + '%' }}</td><td>{{ event.timestamp | date:'d MMM yyyy, HH:mm' }}</td><td><span class="snapshot-missing">Snapshot unavailable</span></td></tr>
        } @empty { <tr><td colspan="6" class="empty">No matching events.</td></tr> }
      </tbody></table></div> }
    }
  `
})
export class DetectionEventsPage {
  private readonly service = inject(DetectionEventService);
  private readonly route = inject(ActivatedRoute);
  readonly refresh = inject(RefreshService);
  readonly events = signal<DetectionEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly type = signal(this.route.snapshot.queryParamMap.get('type') ?? '');
  readonly camera = signal(this.route.snapshot.queryParamMap.get('camera') ?? '');
  readonly date = signal('');
  readonly confidence = signal(0);
  readonly cameras = computed(() => [...new Set(this.events().map((event) => event.cameraId))].sort());
  readonly visible = computed(() => this.events().filter((event) =>
    (!this.type() || event.eventType === this.type()) &&
    (!this.camera() || event.cameraId === this.camera()) &&
    (!this.date() || formatDate(event.timestamp, 'yyyy-MM-dd', 'en-US') === this.date()) &&
    (!this.confidence() || (event.confidence ?? 0) * 100 >= this.confidence())
  ));

  constructor() {
    this.refresh.ticks$.pipe(switchMap(() => this.service.list().pipe(catchError(() => {
      this.error.set(true); this.loading.set(false); return EMPTY;
    }))), takeUntilDestroyed()).subscribe((events) => {
      this.events.set(events); this.error.set(false); this.loading.set(false);
    });
  }
}
