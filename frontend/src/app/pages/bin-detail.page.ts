import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, combineLatest, forkJoin, switchMap } from 'rxjs';
import { BinService } from '../core/api.services';
import { RefreshService } from '../core/refresh.service';
import { Bin, SensorReading } from '../core/models';

@Component({
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-heading"><div><a routerLink="/bins" class="back-link">← All bins</a><h1>{{ bin()?.locationName ?? 'Bin details' }}</h1><p>Current readings and history</p></div></div>
    @if (loading()) { <div class="message">Loading monitoring data...</div> }
    @else if (error()) { <div class="message error">BinSight cannot be reached right now.</div> }
    @else if (!bin()) { <div class="message">No monitoring data available.</div> }
    @else {
      @if (bin()!.fallen) {
        <section class="alert-banner" role="alert">
          <span class="alert-icon"><svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg></span>
          <div>
            <strong>This bin has fallen over</strong>
            <p>It is leaning {{ bin()!.tiltAngle | number:'1.0-1' }}°@if (bin()!.lastUpdated) {, reported {{ bin()!.lastUpdated | date:'d MMM, HH:mm' }} }.
              Set it upright. Until then, the fill level does not show how full it really is.</p>
          </div>
        </section>
      }
      <div class="detail-head"><div><span class="eyebrow">CURRENT STATUS</span><h2>{{ bin()!.fallen ? 'Tipped over' : statusLabel(bin()!) }}</h2>@if (bin()!.readingStale) { <p>This reading is over a day old.</p> }</div></div>
      <div class="detail-grid">
        <div class="metric"><span>Fill level</span><strong>{{ bin()!.fillLevelPercentage === null ? '—' : (bin()!.fillLevelPercentage | number:'1.0-1') + '%' }}</strong></div>
        <div class="metric"><span>Odor</span><strong>{{ bin()!.gasLevel === null ? '—' : (bin()!.gasLevel | number:'1.0-1') }}</strong></div>
        <div class="metric"><span>Leaning</span><strong>{{ bin()!.tiltAngle === null ? '—' : (bin()!.tiltAngle | number:'1.0-1') + '°' }}</strong></div>
        <div class="metric"><span>Last update</span><strong class="metric-date">{{ bin()!.lastUpdated ? (bin()!.lastUpdated | date:'d MMM yyyy, HH:mm') : 'Unavailable' }}</strong></div>
      </div>
      <div class="history-grid">
        @for (metric of metrics; track metric.key) {
          <section class="panel"><div class="section-heading"><div><h2>{{ metric.label }} over time</h2><p>{{ readings().length }} readings</p></div></div>
            @if (readings().length) {
              <div class="history-chart">@for (reading of readings(); track reading.id) {
                <div class="history-bar" [title]="(reading.timestamp | date:'d MMM, HH:mm') + ': ' + (value(reading, metric.key) ?? 'unavailable')">
                  <span [style.height.%]="height(reading, metric.key)"></span><small>{{ reading.timestamp | date:'d MMM' }}</small>
                </div>
              }</div>
            } @else { <div class="empty">No monitoring data available.</div> }
          </section>
        }
      </div>
    }
  `
})
export class BinDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(BinService);
  private readonly refresh = inject(RefreshService);
  readonly bin = signal<Bin | null>(null);
  readonly readings = signal<SensorReading[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  statusLabel(bin: Bin): string {
    if (bin.computedStatus === 'NORMAL') return 'Below capacity';
    if (bin.computedStatus === 'WARNING') return 'Getting full';
    if (bin.computedStatus === 'NEEDS_COLLECTION') return 'Needs collection';
    if (bin.computedStatus === 'CRITICAL') return 'Almost overflowing';
    return 'No reading yet';
  }

  readonly metrics = [
    { key: 'fillLevelPercentage', label: 'Fill level' },
    { key: 'gasLevel', label: 'Odor' },
    { key: 'tiltAngle', label: 'Leaning' }
  ] as const;

  constructor() {
    combineLatest([this.route.paramMap, this.refresh.ticks$]).pipe(
      switchMap(([params]) => forkJoin({
        bin: this.service.get(params.get('id') ?? ''),
        readings: this.service.readings(params.get('id') ?? '')
      }).pipe(catchError(() => { this.error.set(true); this.loading.set(false); return EMPTY; }))),
      takeUntilDestroyed()
    ).subscribe(({ bin, readings }) => {
      this.bin.set(bin); this.readings.set(readings); this.error.set(false); this.loading.set(false);
    });
  }

  value(reading: SensorReading, key: 'fillLevelPercentage' | 'gasLevel' | 'tiltAngle'): number | null {
    return reading[key];
  }

  height(reading: SensorReading, key: 'fillLevelPercentage' | 'gasLevel' | 'tiltAngle'): number {
    const maximum = key === 'fillLevelPercentage' ? 100 : Math.max(1, ...this.readings().map((item) => item[key] ?? 0));
    return (reading[key] ?? 0) / maximum * 100;
  }
}
