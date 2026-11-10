import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, forkJoin, switchMap } from 'rxjs';
import { BinService, CollectionService, DashboardService } from '../core/api.services';
import { RefreshService } from '../core/refresh.service';
import { Bin, CollectionAnalysis, DashboardSummary } from '../core/models';
import { DurationPipe } from '../shared/duration.pipe';

type BinBand = 'below' | 'full' | 'fallen' | 'stale';

@Component({
  imports: [CommonModule, RouterLink, DurationPipe],
  template: `
    <header class="dash-heading">
      <div><h1>BinSight</h1><p>Smart waste monitoring across Amchit</p></div>
      <div class="live-pill" [class.offline]="error()">
        <span class="live-dot"></span>
        <span>{{ error() ? 'Offline' : 'Live' }} · refreshes every {{ refresh.seconds() }}s</span>
        @if (summary()?.lastUpdated) { <time>Updated {{ summary()!.lastUpdated | date:'HH:mm' }}</time> }
      </div>
    </header>

    @if (loading()) {
      <div class="kpi-grid">@for (i of [1, 2, 3, 4]; track i) { <div class="kpi skeleton"></div> }</div>
      <div class="panel-card skeleton chart-skeleton"></div>
    }
    @else if (error()) { <div class="message error">BinSight cannot be reached right now.</div> }
    @else if (!summary() || !bins().length) { <div class="message">No monitoring data available.</div> }
    @else {
      @if (fallen().length) {
        <section class="alert-banner" role="alert">
          <span class="alert-icon"><svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg></span>
          <div>
            <strong>{{ fallen().length === 1 ? '1 bin has fallen over' : fallen().length + ' bins have fallen over' }}</strong>
            <p>Send a crew to set {{ fallen().length === 1 ? 'it' : 'them' }} upright. Fill readings from a fallen bin are unreliable until then.</p>
            <div class="alert-links">
              @for (bin of fallen(); track bin.binId) {
                <a [routerLink]="['/bins', bin.binId]">{{ placeName(bin) }}@if (bin.lastUpdated) { · {{ bin.lastUpdated | date:'d MMM, HH:mm' }} }</a>
              }
            </div>
          </div>
        </section>
      }
      @if (primary(); as bin) {
        <section class="panel-card">
          <div class="section-heading">
            <div>
              <h2>Latest reading</h2>
              <p>{{ placeName(bin) }}@if (bin.lastUpdated) { · {{ bin.lastUpdated | date:'d MMM, HH:mm' }} }</p>
            </div>
            <a [routerLink]="['/bins', bin.binId]">Bin details</a>
          </div>
          <div class="collection-stats">
            <div [class.sensor-full]="band(bin) === 'full'">
              <span>Fill level</span>
              <strong>{{ bin.fillLevelPercentage === null ? '—' : (bin.fillLevelPercentage | number:'1.0-1') + '%' }}</strong>
              <small>{{ fillCaption(bin) }}</small>
            </div>
            <div>
              <span>Odor</span>
              <strong>{{ bin.gasLevel === null ? '—' : (bin.gasLevel | number:'1.0-1') }}</strong>
              <small>How strong the smell is</small>
            </div>
            <div [class.sensor-alert]="bin.fallen">
              <span>Leaning</span>
              <strong>{{ bin.tiltAngle === null ? '—' : (bin.tiltAngle | number:'1.0-1') + '°' }}</strong>
              <small>{{ bin.fallen ? 'Tipped over' : 'Standing upright' }}</small>
            </div>
          </div>
        </section>
      }
      <div class="kpi-grid">
        <a class="kpi total" routerLink="/bins">
          <span class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></span>
          <span class="kpi-label">Total bins</span>
          <strong>{{ bins().length }}</strong>
          <small>{{ clusterCount() }} {{ clusterCount() === 1 ? 'location' : 'locations' }} monitored</small>
        </a>
        <a class="kpi good" routerLink="/bins" [queryParams]="{ status: 'NORMAL' }">
          <span class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg></span>
          <span class="kpi-label">Below capacity</span>
          <strong>{{ counts().below }}</strong>
          <small>Under {{ fullAt() }}% full@if (primary()?.fillLevelPercentage !== null && primary()?.fillLevelPercentage !== undefined) { · now {{ primary()!.fillLevelPercentage | number:'1.0-1' }}% }</small>
          <span class="kpi-bar"><span [style.width.%]="share().below"></span></span>
        </a>
        <a class="kpi full" routerLink="/bins">
          <span class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M12 4v10M12 18v2"/><circle cx="12" cy="12" r="10"/></svg></span>
          <span class="kpi-label">Full capacity</span>
          <strong>{{ counts().full }}</strong>
          <small>{{ fullAt() }}% full or more</small>
          <span class="kpi-bar"><span [style.width.%]="share().full"></span></span>
        </a>
        <a class="kpi down" [class.alerting]="fallen().length" routerLink="/bins" [queryParams]="{ status: 'FALLEN' }" title="Bins whose tilt sensor shows they have fallen over">
          <span class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M3 20h18M7 17l-3-9 9-3 3 9z M5.5 10.5l9-3"/></svg></span>
          <span class="kpi-label">Fallen bins</span>
          <strong>{{ fallen().length }}</strong>
          <small>@if (fallen().length === 1) { {{ placeName(fallen()[0]) }} } @else if (fallen().length) { Need to be set upright } @else { All standing upright }</small>
        </a>
      </div>

      <section class="panel-card">
        <div class="section-heading"><div><h2>Collections</h2><p>Truck pickups matched with fill levels · last 30 days</p></div><a routerLink="/collections">All collections</a></div>
        <div class="collection-stats">
          <div><span>Avg. pickup time</span><strong>{{ collections().summary.averageResponseMinutes | duration }}</strong><small>From {{ fullAt() }}% full until the truck arrives</small></div>
          <a class="status-confirmed" routerLink="/collections" [queryParams]="{ status: 'CONFIRMED' }"><span>Confirmed</span><strong>{{ collections().summary.confirmed }}</strong></a>
          <a class="status-missed" routerLink="/collections" [queryParams]="{ status: 'MISSED' }"><span>Missed pickup</span><strong>{{ collections().summary.missed }}</strong></a>
          <a class="status-overdue" routerLink="/collections" [queryParams]="{ status: 'OVERDUE' }"><span>Overdue</span><strong>{{ collections().summary.overdue }}</strong></a>
        </div>
      </section>

      <section class="panel-card">
        <div class="section-heading"><div><h2>Fill levels</h2><p>Last reported fill for every bin</p></div><a routerLink="/bins">All bins</a></div>
        <div class="fill-scroll">
          <div class="fill-chart">
            <div class="fill-grid">
              @for (tick of [100, 75, 50, 25]; track tick) { <span [style.bottom.%]="tick"><em>{{ tick }}%</em></span> }
              <span class="threshold" [style.bottom.%]="fullAt()"><em>{{ fullAt() }}%</em></span>
            </div>
            @for (bin of bins(); track bin.binId) {
              <a class="fill-col" [routerLink]="['/bins', bin.binId]" [title]="placeName(bin) + ': ' + (bin.fallen ? 'tipped over' : (bin.fillLevelPercentage ?? 0) + '%' + (bin.readingStale ? ', reading is over a day old' : ''))">
                <span class="fill-track">
                  <span [class]="'fill-bar ' + band(bin)" [style.height.%]="bin.fallen ? 100 : bin.fillLevelPercentage ?? 0">
                    <b>@if (bin.fallen) { Fallen } @else { {{ bin.fillLevelPercentage ?? 0 | number:'1.0-0' }}% }</b>
                  </span>
                </span>
                <small>{{ placeName(bin) }}</small>
              </a>
            }
          </div>
        </div>
        <div class="chart-legend">
          @for (band of bands; track band.key) { <span><i [class]="band.key"></i>{{ band.label }}</span> }
        </div>
      </section>
    }
  `
})
export class DashboardPage {
  private readonly binService = inject(BinService);
  private readonly dashboardService = inject(DashboardService);
  private readonly collectionService = inject(CollectionService);
  readonly refresh = inject(RefreshService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly bins = signal<Bin[]>([]);
  readonly collections = signal<CollectionAnalysis>({
    summary: { confirmed: 0, incomplete: 0, pending: 0, missed: 0, overdue: 0, averageResponseMinutes: null },
    records: []
  });
  readonly bands: { key: BinBand; label: string }[] = [
    { key: 'below', label: 'Below capacity' },
    { key: 'full', label: 'Full capacity' },
    { key: 'fallen', label: 'Tipped over' },
    { key: 'stale', label: 'No recent reading' }
  ];
  readonly fullAt = computed(() => this.summary()?.fullFillPercentage ?? 70);
  readonly primary = computed(() => this.bins().reduce<Bin | null>((latest, bin) => {
    if (!latest?.lastUpdated) return bin;
    if (!bin.lastUpdated) return latest;
    return bin.lastUpdated > latest.lastUpdated ? bin : latest;
  }, null));
  readonly clusterCount = computed(() => new Set(this.bins().map((bin) => bin.clusterId)).size);
  readonly fallen = computed(() => this.bins().filter((bin) => bin.fallen));
  readonly counts = computed(() => {
    const counts: Record<BinBand, number> = { below: 0, full: 0, fallen: 0, stale: 0 };
    for (const bin of this.bins()) counts[this.band(bin)]++;
    return counts;
  });
  readonly share = computed(() => {
    const total = this.bins().length || 1;
    const counts = this.counts();
    return Object.fromEntries(this.bands.map(({ key }) => [key, counts[key] / total * 100])) as Record<BinBand, number>;
  });

  constructor() {
    this.refresh.ticks$.pipe(
      switchMap(() => forkJoin({
        summary: this.dashboardService.summary(), bins: this.binService.list(), collections: this.collectionService.list()
      }).pipe(catchError(() => { this.error.set(true); this.loading.set(false); return EMPTY; }))),
      takeUntilDestroyed()
    ).subscribe(({ summary, bins, collections }) => {
      this.summary.set(summary); this.bins.set(bins); this.collections.set(collections);
      this.error.set(false); this.loading.set(false);
    });
  }

  band(bin: Bin): BinBand {
    if (bin.fallen) return 'fallen';
    if (bin.fillLevelPercentage === null) return 'stale';
    return bin.fillLevelPercentage < this.fullAt() ? 'below' : 'full';
  }

  placeName(bin: Bin): string {
    return bin.locationName ?? 'This bin';
  }

  fillCaption(bin: Bin): string {
    if (bin.fillLevelPercentage === null) return 'Waiting for a sensor reading';
    const state = bin.fillLevelPercentage < this.fullAt() ? 'Below capacity' : 'Full capacity';
    return bin.readingStale ? `${state} · reading is over a day old` : state;
  }
}
