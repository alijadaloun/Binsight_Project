import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, signal } from '@angular/core';
import * as L from 'leaflet';
import { Bin, ComputedBinStatus } from '../core/models';

const colors: Record<ComputedBinStatus, string> = {
  NORMAL: '#16846b', WARNING: '#d89d2c', NEEDS_COLLECTION: '#df693b', CRITICAL: '#c4384b'
};

@Component({ selector: 'app-cluster-map', template: '<div class="map-surface"><div #canvas class="map-canvas" aria-label="Bin cluster map"></div>@if (tilesUnavailable()) { <div class="map-tile-error" role="status">Street map unavailable</div> } @else if (tilesLoading()) { <div class="map-tile-error" role="status">Loading street map</div> }</div>' })
export class ClusterMap implements AfterViewInit, OnChanges, OnDestroy {
  @Input() bins: Bin[] = [];
  @ViewChild('canvas') private canvas!: ElementRef<HTMLDivElement>;
  private map?: L.Map;
  private readonly markers = L.layerGroup();
  readonly tilesUnavailable = signal(false);
  readonly tilesLoading = signal(true);
  private tileTimeout?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    this.map = L.map(this.canvas.nativeElement, { scrollWheelZoom: false });
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    });
    tiles.on('tileerror', () => { this.tilesLoading.set(false); this.tilesUnavailable.set(true); });
    tiles.on('tileload', () => { this.tilesLoading.set(false); this.tilesUnavailable.set(false); });
    tiles.addTo(this.map);
    this.tileTimeout = setTimeout(() => {
      if (this.tilesLoading()) { this.tilesLoading.set(false); this.tilesUnavailable.set(true); }
    }, 5000);
    this.markers.addTo(this.map);
    this.render();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnChanges(): void { this.render(); }
  ngOnDestroy(): void { clearTimeout(this.tileTimeout); this.map?.remove(); }

  private render(): void {
    if (!this.map) return;
    this.markers.clearLayers();
    const groups = new Map<string, Bin[]>();
    for (const bin of this.bins) {
      if (bin.latitude === null || bin.longitude === null) continue;
      groups.set(bin.clusterId, [...(groups.get(bin.clusterId) ?? []), bin]);
    }
    const points: L.LatLngExpression[] = [];
    const rank: Record<ComputedBinStatus, number> = {
      NORMAL: 0, WARNING: 1, NEEDS_COLLECTION: 2, CRITICAL: 3
    };
    for (const bins of groups.values()) {
      const first = bins[0];
      const point: L.LatLngExpression = [first.latitude!, first.longitude!];
      points.push(point);
      const status = bins.reduce<ComputedBinStatus | null>((worst, bin) =>
        bin.computedStatus && (!worst || rank[bin.computedStatus] > rank[worst]) ? bin.computedStatus : worst, null);
      const fallen = bins.filter((bin) => bin.fallen).map((bin) => bin.binId);
      const popup = document.createElement('div');
      for (const [index, detail] of [
        first.locationName ?? first.clusterId, first.clusterId, `${bins.length} bins`,
        ...(fallen.length ? [`Fallen over: ${fallen.join(', ')}`] : []),
        `Status: ${status?.replaceAll('_', ' ') ?? 'Unknown'}`,
        `Highest fill: ${Math.max(...bins.map((bin) => bin.fillLevelPercentage ?? 0)).toFixed(1)}%`,
        `Last update: ${bins.map((bin) => bin.lastUpdated).filter(Boolean).sort().at(-1) ?? 'Unavailable'}`
      ].entries()) {
        const line = document.createElement(index ? 'div' : 'strong');
        line.textContent = detail;
        popup.append(line);
      }
      L.circleMarker(point, {
        radius: 12, weight: 3, color: fallen.length ? '#c83855' : '#fff',
        fillColor: fallen.length ? colors.CRITICAL : status ? colors[status] : '#71827f', fillOpacity: 1
      }).bindPopup(popup).addTo(this.markers);
    }
    if (points.length) this.map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14 });
  }
}
