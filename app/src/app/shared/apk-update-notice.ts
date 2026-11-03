import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ApkUpdateService } from '../core/app-update/apk-update.service';
import { TranslatePipe } from '../core/i18n/i18n.service';

/**
 * "There's a new version of the app": a parchment scrap at the top of the page, only in the
 * Android app when GitHub has a later APK. The link opens the download in the system browser
 * (Capacitor sends links to other sites out of the WebView).
 */
@Component({
  selector: 'app-apk-update-notice',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (update.available(); as release) {
      <aside class="sticky apk-update" role="status">
        <p>
          <strong>{{ 'apkUpdate.title' | t }}</strong>
          {{ 'apkUpdate.text' | t: { build: release.build } }}
        </p>
        <div class="actions">
          <a class="btn btn-primary" [href]="release.url" target="_blank" rel="noopener">
            {{ 'apkUpdate.download' | t }}
          </a>
          <button type="button" class="btn-ghost" (click)="update.dismiss()">
            {{ 'apkUpdate.dismiss' | t }}
          </button>
        </div>
      </aside>
    }
  `,
  styles: `
    .apk-update {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
      margin-top: 0;
    }

    p {
      margin: 0;
      flex: 1 1 16rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    // the scrap makes its links ink-coloured: keep the seal's light letters
    .actions .btn-primary {
      color: #fff4dc;
      font-weight: 400;
    }
  `,
})
export class ApkUpdateNotice {
  protected readonly update = inject(ApkUpdateService);
}
