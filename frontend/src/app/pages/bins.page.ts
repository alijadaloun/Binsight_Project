import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { BinService } from '../core/api.services';
import { RefreshService } from '../core/refresh.service';
import { Bin } from '../core/models';

type SortKey = 'binId' | 'clusterId' | 'locationName' | 'fillLevelPercentage' | 'gasLevel' | 'tiltAngle' | 'computedStatus' | 'lastUpdated';

@Component({
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-heading"><div><p class="eyebrow">MONITORING</p><h1>Bins</h1><p>How full each place is</p></div><span class="refresh-note">Updated every {{ refresh.seconds() }} seconds</span></div>
    @if (loading()) { <div class="message">Loading monitoring data...</div> }
    @else if (error()) { <div class="message error">BinSight cannot be reached right now.</div> }
    @else {
      <div class="toolbar">
        <label class="search-field"><span>Search</span><input type="search" placeholder="Search by place" [ngModel]="search()" (ngModelChange)="search.set($event)" /></label>
        <label><span>Status</span><select [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="">All statuses</option><option value="NORMAL">Below capacity</option><option value="WARNING">Getting full</option><option value="NEEDS_COLLECTION">Needs collection</option><option value="CRITICAL">Almost overflowing</option><option value="FALLEN">Tipped over</option><option value="STALE">No recent reading</option><option value="UNKNOWN">No reading yet</option></select></label>
        <label><span>Area</span><select [ngModel]="cluster()" (ngModelChange)="cluster.set($event)"><option value="">All areas</option>@for (id of clusters(); track id) { <option [value]="id">{{ areaName(id) }}</option> }</select></label>
        <span class="result-count">{{ visible().length }} of {{ bins().length }} bins</span>
      </div>
      @if (!bins().length) { <div class="message">No monitoring data available.</div> }
      @else {
        <div class="table-wrap"><table><thead><tr>
          <th><button (click)="sortBy('locationName')">Place</button></th><th><button (click)="sortBy('computedStatus')">Status</button></th><th><button (click)="sortBy('fillLevelPercentage')">Fill level</button></th><th><button (click)="sortBy('gasLevel')">Odor</button></th><th><button (click)="sortBy('tiltAngle')">Leaning</button></th><th><button (click)="sortBy('lastUpdated')">Last updated</button></th><th>Actions</th>
        </tr></thead><tbody>
          @for (bin of visible(); track bin.binId) { <tr><td><a class="strong-link" [routerLink]="['/bins', bin.binId]">{{ bin.locationName ?? 'This bin' }}</a></td><td><span [class]="'status-tag ' + state(bin).toLowerCase()">{{ label(bin) }}</span></td><td><div class="level-cell"><span class="mini-track"><span [style.width.%]="bin.fillLevelPercentage ?? 0" [class]="bin.computedStatus?.toLowerCase() ?? 'unknown'"></span></span>{{ bin.fillLevelPercentage === null ? 'No reading' : (bin.fillLevelPercentage | number:'1.0-1') + '%' }}</div></td><td>{{ bin.gasLevel === null ? 'No reading' : (bin.gasLevel | number:'1.0-1') }}</td><td>{{ bin.tiltAngle === null ? 'No reading' : (bin.tiltAngle | number:'1.0-1') + '°' }}</td><td>{{ bin.lastUpdated ? (bin.lastUpdated | date:'d MMM, HH:mm') : 'No reading' }}</td><td><a [routerLink]="['/bins', bin.binId]">View</a></td></tr> }
          @empty { <tr><td colspan="7" class="empty">No matching bins.</td></tr> }
        </tbody></table></div>
      }
    }
  `
})
export class BinsPage {
  private readonly service = inject(BinService);
  private readonly route = inject(ActivatedRoute);
  readonly refresh = inject(RefreshService);
  readonly bins = signal<Bin[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly search = signal('');
  readonly status = signal(this.route.snapshot.queryParamMap.get('status') ?? '');
  readonly cluster = signal('');
  readonly sortKey = signal<SortKey>('binId');
  readonly descending = signal(false);
  readonly clusters = computed(() => [...new Set(this.bins().map((bin) => bin.clusterId))].sort());
  readonly visible = computed(() => {
    const query = this.search().trim().toLowerCase();
    const key = this.sortKey();
    const multiplier = this.descending() ? -1 : 1;
    return this.bins().filter((bin) =>
      (!query || [bin.binId, bin.clusterId, bin.locationName ?? ''].some((value) => value.toLowerCase().includes(query))) &&
      (!this.status() || this.state(bin) === this.status()) &&
      (!this.cluster() || bin.clusterId === this.cluster())
    ).sort((a, b) => {
      const left = a[key] ?? '';
      const right = b[key] ?? '';
      return multiplier * (typeof left === 'number' && typeof right === 'number'
        ? left - right : String(left).localeCompare(String(right)));
    });
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.status.set(params.get('status') ?? '');
    });
    this.refresh.ticks$.pipe(switchMap(() => this.service.list().pipe(catchError(() => {
      this.error.set(true); this.loading.set(false); return EMPTY;
    }))), takeUntilDestroyed()).subscribe((bins) => {
      this.bins.set(bins); this.error.set(false); this.loading.set(false);
    });
  }

  // A fallen bin outranks its fill status: its fill reading no longer measures the waste.
  label(bin: Bin): string {
    const state = this.state(bin);
    if (state === 'NORMAL') return 'Below capacity';
    if (state === 'WARNING') return 'Getting full';
    if (state === 'NEEDS_COLLECTION') return 'Needs collection';
    if (state === 'CRITICAL') return 'Almost overflowing';
    if (state === 'FALLEN') return 'Tipped over';
    if (state === 'STALE') return 'No recent reading';
    return 'No reading yet';
  }

  areaName(clusterId: string): string {
    return this.bins().find((bin) => bin.clusterId === clusterId)?.locationName ?? 'This area';
  }

  state(bin: Bin): string {
    if (bin.fallen) return 'FALLEN';
    if (bin.computedStatus) return bin.computedStatus;
    return bin.readingStale ? 'STALE' : 'UNKNOWN';
  }

  sortBy(key: SortKey): void {
    this.descending.set(this.sortKey() === key ? !this.descending() : false);
    this.sortKey.set(key);
  }
}
