import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { HomebrewStore } from '../homebrew/homebrew-store.service';
import { I18nService } from '../i18n/i18n.service';
import { Character } from '../models/character';
import {
  ParsedFile,
  backupFileName,
  backupOf,
  backupText,
  characterFileName,
  parseImportText,
} from './backup';
import { CharacterStore } from './character-store.service';

/** How an export ended: a download, a share sheet, or the user closed the share sheet. */
export type ExportOutcome = 'downloaded' | 'shared' | 'cancelled';

export interface ReadFile extends ParsedFile {
  fileName: string;
}

/**
 * Writes backup files and reads them back.
 *
 *  - Web: a download (Blob + <a download>); where the browser can share files (phones), the
 *    share sheet as an alternative.
 *  - Android app (Capacitor): <a download> does nothing in the WebView, so the file is written to
 *    the app's cache (no permissions needed) and handed to the Android share sheet, from where it
 *    can be saved to Drive / Files or sent.
 *  - Import: an <input type="file"> works in both; this reads the chosen files.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly store = inject(CharacterStore);
  private readonly i18n = inject(I18nService);
  private readonly homebrew = inject(HomebrewStore);

  readonly native = Capacitor.isNativePlatform();

  /** Web Share API with files (mobile browsers): offer "Share" next to the download. */
  readonly canShareFiles = !this.native && canShareFiles();

  async exportCharacter(c: Character, share = false): Promise<ExportOutcome> {
    return this.export(characterFileName(c.name), backupText(c), share);
  }

  /** All the characters and custom backgrounds on this device (null: there are none). */
  async exportAll(share = false): Promise<ExportOutcome | null> {
    await Promise.all([this.store.load(), this.homebrew.load()]);
    const characters = this.store.all().map((r) => r.character);
    const backgrounds = this.homebrew.backgrounds();
    if (!characters.length && !backgrounds.length) return null;
    const name = backupFileName(this.i18n.t('backup.fileWord'));
    return this.export(name, backupText(backupOf(characters, new Date(), backgrounds)), share);
  }

  /** Reads each chosen file; unreadable ones come back with an error. */
  async readFiles(files: Iterable<File>): Promise<ReadFile[]> {
    const out: ReadFile[] = [];
    for (const file of files) {
      try {
        out.push({ fileName: file.name, ...parseImportText(await file.text()) });
      } catch {
        out.push({
          fileName: file.name,
          characters: [],
          backgrounds: [],
          invalid: 0,
          error: 'not-json',
        });
      }
    }
    return out;
  }

  /**
   * A binary file (the PDF of a sheet): a download on the web, the share sheet where files can
   * be shared (phones) or in the Android app, after writing it to the app's cache.
   */
  async exportBinary(
    fileName: string,
    bytes: Uint8Array,
    mime: string,
    share = false,
  ): Promise<ExportOutcome> {
    if (this.native) {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ]);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: btoa(binary),
        directory: Directory.Cache,
      });
      try {
        await Share.share({
          title: fileName,
          files: [uri],
          dialogTitle: this.i18n.t('backup.shareTitle'),
        });
        return 'shared';
      } catch (e) {
        if (/cancel/i.test((e as Error)?.message ?? '')) return 'cancelled';
        throw e;
      }
    }
    const blob = new Blob([bytes as BlobPart], { type: mime });
    if (share && this.canShareFiles) {
      try {
        await navigator.share({
          files: [new File([blob], fileName, { type: mime })],
          title: fileName,
        });
        return 'shared';
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return 'cancelled';
        throw e;
      }
    }
    downloadBlob(fileName, blob);
    return 'downloaded';
  }

  private async export(fileName: string, text: string, share: boolean): Promise<ExportOutcome> {
    if (this.native) return this.shareNative(fileName, text);
    if (share && this.canShareFiles) return this.shareWeb(fileName, text);
    download(fileName, text);
    return 'downloaded';
  }

  private async shareNative(fileName: string, text: string): Promise<ExportOutcome> {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({
        title: fileName,
        files: [uri],
        dialogTitle: this.i18n.t('backup.shareTitle'),
      });
      return 'shared';
    } catch (e) {
      // closing the share sheet rejects with "Share canceled"
      if (/cancel/i.test((e as Error)?.message ?? '')) return 'cancelled';
      throw e;
    }
  }

  private async shareWeb(fileName: string, text: string): Promise<ExportOutcome> {
    const file = new File([text], fileName, { type: 'application/json' });
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
      throw e;
    }
  }
}

function download(fileName: string, text: string): void {
  downloadBlob(fileName, new Blob([text], { type: 'application/json' }));
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}
