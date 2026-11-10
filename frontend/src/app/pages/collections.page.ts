import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { CollectionService } from '../core/api.services';
import { RefreshService } from '../core/refresh.service';
import { CollectionAnalysis, CollectionStatus } from '../core/models';
import { DurationPipe } from '../shared/duration.pipe';

export const collectionStatusLabels: Record<CollectionStatus, string> = {
  CONFIRMED: 'Confirmed',
  INCOMPLETE: 'Incomplete',
  PENDING: 'Pending',
  MISSED: 'Missed pickup',
  OVERDUE: 'Overdue'
};

@Component({
  imports: [CommonModule, FormsModule, RouterLink, DurationPipe],
  template: `
    <div class="page-heading"><div><p class="eyebrow">OPERATIONS</p><h1>Collections</h1><p>Truck pickups matched with bin fill levels over the last 30 days</p></div><span class="refresh-note">Updated every {{ refresh.seconds() }} seconds</span></div>
    @if (loading()) { <div class="message">Loading monitoring data...</div> }
    @else if (error()) { <div class="message error">BinSight cannot be reached right now.</div> }
    @else {
      <div class="collection-stats">
        <div><span>Avg. pickup time</span><strong>{{ data()!.summary.averageResponseMinutes | duration }}</strong><small>From 70% full until the truck arrives</small></div>
        @for (status of statuses; track status) {
          <button type="button" [class]="'status-' + status.toLowerCase()" [class.selected]="filter() === status" (click)="filter.set(filter() === status ? '' : status)">
            <span>{{ labels[status] }}</span><strong>{{ count(status) }}</strong>
          </button>
        }
      </div>
      <div class="toolbar">
        <label><span>Status</span><select [ngModel]="filter()" (ngModelChange)="filter.set($event)"><option value="">All statuses</option>@for (status of statuses; track status) { <option [value]="status">{{ labels[status] }}</option> }</select></label>
        <span class="result-count">{{ visible().length }} records</span>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Status</th><th>Bin</th><th>Location</th><th>Full since</th><th>Truck</th><th>Fill before → after</th><th>Response time</th></tr></thead><tbody>
        @for (record of visible(); track record.status + record.binId + (record.eventId ?? '')) {
          <tr>
            <td><span [class]="'status-tag collection-' + record.status.toLowerCase()">{{ labels[record.status] }}</span></td>
            <td><a class="strong-link" [routerLink]="['/bins', record.binId]">{{ record.binId }}</a></td>
            <td>{{ record.locationName ?? 'Unknown' }}</td>
            <td>{{ record.fullSince | date:'d MMM, HH:mm' }}</td>
            <td>@if (record.truckAt) { {{ record.truckAt | date:'d MMM, HH:mm' }} <small class="muted-note">{{ record.status === 'MISSED' ? 'passed' : 'stopped' }}</small> } @else { No truck }</td>
            <td>{{ record.fillBefore | number:'1.0-0' }}% → {{ record.fillAfter === null ? '?' : (record.fillAfter | number:'1.0-0') + '%' }}</td>
            <td>{{ record.responseMinutes | duration }}@if (record.status === 'OVERDUE') { <small class="muted-note">so far</small> }</td>
          </tr>
        } @empty { <tr><td colspan="7" class="empty">No collection records. Records appear when a camera sees a truck at a bin that is 70% full or more.</td></tr> }
      </tbody></table></div>
    }
  `
})
export class CollectionsPage {
  private readonly service = inject(CollectionService);
  private readonly route = inject(ActivatedRoute);
  readonly refresh = inject(RefreshService);
  readonly labels = collectionStatusLabels;
  readonly statuses = Object.keys(collectionStatusLabels) as CollectionStatus[];
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly data = signal<CollectionAnalysis | null>(null);
  readonly filter = signal(this.route.snapshot.queryParamMap.get('status') ?? '');
  readonly visible = computed(() => (this.data()?.records ?? []).filter((record) => !this.filter() || record.status === this.filter()));

  constructor() {
    this.refresh.ticks$.pipe(
      switchMap(() => this.service.list().pipe(catchError(() => { this.error.set(true); this.loading.set(false); return EMPTY; }))),
      takeUntilDestroyed()
    ).subscribe((data) => { this.data.set(data); this.error.set(false); this.loading.set(false); });
  }

  count(status: CollectionStatus): number {
    return this.data()!.summary[status.toLowerCase() as Lowercase<CollectionStatus>];
  }
}
