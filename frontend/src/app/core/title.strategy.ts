import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

// Keeps the browser tab title and the top bar page name in sync with the route title.
@Injectable({ providedIn: 'root' })
export class BinSightTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  readonly current = signal('');

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot) ?? '';
    this.current.set(page);
    this.title.setTitle(page ? `${page} · BinSight` : 'BinSight');
  }
}
