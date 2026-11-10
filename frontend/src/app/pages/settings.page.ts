import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RefreshService } from '../core/refresh.service';

@Component({
  imports: [FormsModule],
  template: `
    <div class="page-heading"><div><p class="eyebrow">SYSTEM</p><h1>Settings</h1><p>Monitoring configuration</p></div></div>
    <section class="settings-section"><h2>Data source</h2><div class="setting-row"><span>Monitoring API</span><strong>BinSight backend</strong></div><div class="setting-row"><label for="refresh-select">Refresh interval</label><select id="refresh-select" [ngModel]="refresh.seconds()" (ngModelChange)="refresh.setSeconds(+$event)"><option [ngValue]="15">15 seconds</option><option [ngValue]="30">30 seconds</option><option [ngValue]="60">60 seconds</option></select></div><div class="setting-row"><span>Location</span><strong>Amchit, Lebanon</strong></div></section>
    <section class="settings-section"><h2>Operational thresholds</h2><div class="setting-row"><span>Below capacity</span><strong>Under 70% full</strong></div><div class="setting-row"><span>Full capacity</span><strong>70% or more</strong></div><div class="setting-row"><span>Warning</span><strong>70-84%</strong></div><div class="setting-row"><span>Needs collection</span><strong>85-94%</strong></div><div class="setting-row"><span>Critical</span><strong>95-100%</strong></div><div class="setting-row"><span>Tipped over</span><strong>When it leans too far</strong></div></section>
  `
})
export class SettingsPage { readonly refresh = inject(RefreshService); }
