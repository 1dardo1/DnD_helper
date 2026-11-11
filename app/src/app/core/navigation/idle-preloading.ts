import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, mergeMap, of, timer } from 'rxjs';

/** After the first page has loaded its data, not competing with it. */
export const PRELOAD_DELAY_MS = 4000;

/** The part of navigator.connection (Network Information API, Chrome/Android) that matters. */
interface Connection {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Downloads the code of the most visited pages (routes with `data: { preload: true }`) a few
 * seconds after the app starts, so opening them later doesn't wait for the network. Not with the
 * data saver on or a 2G connection. The installed web app also keeps every file through the
 * service worker; this helps the first visit and the Android app's WebView.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloading implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.data?.['preload'] || !worthPreloading(connectionOf(navigator))) return of(null);
    return timer(PRELOAD_DELAY_MS).pipe(mergeMap(() => load()));
  }
}

export function worthPreloading(connection: Connection | undefined): boolean {
  if (connection?.saveData) return false;
  return !/(^|-)2g$/.test(connection?.effectiveType ?? '');
}

function connectionOf(nav: Navigator): Connection | undefined {
  return (nav as Navigator & { connection?: Connection }).connection;
}
