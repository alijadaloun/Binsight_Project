import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap, timer } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly allowed = [15, 30, 60];
  readonly seconds = signal(this.initialSeconds());
  readonly ticks$ = toObservable(this.seconds).pipe(switchMap((seconds) => timer(0, seconds * 1000)));

  setSeconds(value: number): void {
    if (!this.allowed.includes(value)) return;
    localStorage.setItem('binsight-refresh-seconds', String(value));
    this.seconds.set(value);
  }

  private initialSeconds(): number {
    const value = Number(localStorage.getItem('binsight-refresh-seconds'));
    return this.allowed.includes(value) ? value : 30;
  }
}
