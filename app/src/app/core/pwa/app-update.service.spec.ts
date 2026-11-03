import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  it('does nothing without a service worker', () => {
    expect(TestBed.inject(AppUpdateService).ready()).toBe(false);
  });

  it('offers to reload once a new version is ready', () => {
    const versionUpdates = new Subject<VersionEvent>();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates,
            unrecoverable: new Subject(),
            checkForUpdate: async () => false,
          },
        },
      ],
    });
    const service = TestBed.inject(AppUpdateService);
    const version = { hash: 'a' };
    versionUpdates.next({ type: 'VERSION_DETECTED', version });
    expect(service.ready()).toBe(false);
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: version,
      latestVersion: { hash: 'b' },
    });
    expect(service.ready()).toBe(true);
  });
});
