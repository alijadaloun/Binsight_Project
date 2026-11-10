import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { BinService } from '../core/api.services';
import { RefreshService } from '../core/refresh.service';
import { Bin } from '../core/models';
import { ClusterMap } from '../shared/cluster-map';

@Component({
  imports: [CommonModule, RouterLink, ClusterMap],
  template: `
    <div class="page-heading"><div><p class="eyebrow">GEOGRAPHY</p><h1>Map</h1><p>Bin clusters in Amchit</p></div><span class="refresh-note">Updated every {{ refresh.seconds() }} seconds</span></div>
    @if (loading()) { <div class="message">Loading monitoring data...</div> }
    @else if (error()) { <div class="message error">BinSight cannot be reached right now.</div> }
    @else if (!bins().length) { <div class="message">No monitoring data available.</div> }
    @else {
      <div class="map-page-layout"><section class="panel map-full"><app-cluster-map [bins]="bins()" /></section>
        <section class="cluster-list"><div class="section-heading"><div><h2>Clusters</h2><p>{{ clusters().length }} monitored locations</p></div></div>
          @for (cluster of clusters(); track cluster.id) {
            <div class="cluster-row"><strong>{{ cluster.name }}</strong><span>{{ cluster.id }}</span><small>{{ cluster.bins.length }} bins · Highest fill {{ cluster.highest | number:'1.0-1' }}%</small>
              <div class="cluster-links">@for (bin of cluster.bins; track bin.binId) { <a [routerLink]="['/bins', bin.binId]">{{ bin.binId }}</a> }</div>
            </div>
          }
        </section>
      </div>
    }
  `
})
export class MapPage {
  private readonly service = inject(BinService);
  readonly refresh = inject(RefreshService);
  readonly bins = signal<Bin[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly clusters = computed(() => {
    const groups = new Map<string, Bin[]>();
    for (const bin of this.bins()) groups.set(bin.clusterId, [...(groups.get(bin.clusterId) ?? []), bin]);
    return [...groups].map(([id, bins]) => ({
      id, name: bins[0].locationName ?? id, bins,
      highest: Math.max(...bins.map((bin) => bin.fillLevelPercentage ?? 0))
    }));
  });

  constructor() {
    this.refresh.ticks$.pipe(switchMap(() => this.service.list().pipe(catchError(() => {
      this.error.set(true); this.loading.set(false); return EMPTY;
    }))), takeUntilDestroyed()).subscribe((bins) => {
      this.bins.set(bins); this.error.set(false); this.loading.set(false);
    });
  }
}
