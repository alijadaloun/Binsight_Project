import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', title: 'Dashboard', loadComponent: () => import('./pages/dashboard.page').then((m) => m.DashboardPage) },
  { path: 'bins', title: 'Bins', loadComponent: () => import('./pages/bins.page').then((m) => m.BinsPage) },
  { path: 'bins/:id', title: 'Bin details', loadComponent: () => import('./pages/bin-detail.page').then((m) => m.BinDetailPage) },
  { path: 'map', title: 'Map', loadComponent: () => import('./pages/map.page').then((m) => m.MapPage) },
  { path: 'cameras', title: 'Cameras', loadComponent: () => import('./pages/cameras.page').then((m) => m.CamerasPage) },
  { path: 'detection-events', title: 'Camera alerts', loadComponent: () => import('./pages/detection-events.page').then((m) => m.DetectionEventsPage) },
  { path: 'collections', title: 'Collections', loadComponent: () => import('./pages/collections.page').then((m) => m.CollectionsPage) },
  { path: 'settings', title: 'Settings', loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: 'dashboard' }
];
