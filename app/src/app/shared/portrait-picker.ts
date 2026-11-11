import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  CENTERED,
  Framing,
  PORTRAIT_MAX_ZOOM,
  checkPortraitFile,
  cropRect,
  dragFraming,
  renderPortrait,
  zoomFraming,
} from '../core/characters/portrait';
import { TranslatePipe } from '../core/i18n/i18n.service';

/** A picked image waiting to be framed. */
interface Pending {
  url: string;
  img: HTMLImageElement;
  width: number;
  height: number;
}

type PickError = 'format' | 'tooLarge' | 'decode';

/**
 * Picks the character's picture: "Upload image" (or "Take photo" on phones), a square framing
 * step (drag to move, slider/wheel/pinch to zoom, arrow keys) and "Remove image". The result is a
 * small WebP/JPEG data URL (core/characters/portrait.ts) emitted through `valueChange`; the
 * original file never leaves the browser.
 */
@Component({
  selector: 'app-portrait-picker',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      @if (pending(); as p) {
        <div class="frame-step">
          <p class="hint" id="frame-hint">{{ 'portrait.frame' | t }}</p>
          <div
            #viewport
            class="viewport"
            tabindex="0"
            role="group"
            aria-describedby="frame-hint"
            data-testid="portrait-viewport"
            (pointerdown)="down($event)"
            (pointermove)="move($event)"
            (pointerup)="up($event)"
            (pointercancel)="up($event)"
            (wheel)="wheel($event)"
            (keydown)="key($event)"
          >
            <img
              class="source"
              alt=""
              draggable="false"
              [src]="p.url"
              [style.width.%]="imgStyle().w"
              [style.left.%]="imgStyle().x"
              [style.top.%]="imgStyle().y"
            />
            <span class="guide" aria-hidden="true"></span>
          </div>
          <label class="zoom">
            {{ 'portrait.zoom' | t }}
            <input
              type="range"
              min="1"
              [max]="maxZoom"
              step="0.01"
              [value]="framing().zoom"
              (input)="setZoom($any($event.target).valueAsNumber)"
            />
          </label>
          <div class="row">
            <button type="button" class="btn btn-primary" (click)="apply()">
              {{ 'portrait.apply' | t }}
            </button>
            <button type="button" class="btn" (click)="cancel()">
              {{ 'portrait.cancel' | t }}
            </button>
          </div>
        </div>
      } @else {
        <div class="row main">
          <span class="preview" [class.empty]="!value()" data-testid="portrait-preview">
            @if (value(); as v) {
              <img [src]="v" [alt]="'portrait.preview' | t: { name: name() }" />
            } @else {
              <span class="none">{{ 'portrait.none' | t }}</span>
            }
          </span>
          <div class="buttons">
            <button type="button" class="btn" (click)="file.click()">
              {{ (value() ? 'portrait.change' : 'portrait.upload') | t }}
            </button>
            @if (touch) {
              <button type="button" class="btn" (click)="camera.click()">
                {{ 'portrait.camera' | t }}
              </button>
            }
            @if (value()) {
              <button type="button" class="btn btn-ghost" (click)="remove()">
                {{ 'portrait.remove' | t }}
              </button>
            }
          </div>
        </div>
      }

      @if (error(); as e) {
        <p class="error" role="alert" data-testid="portrait-error">
          {{ 'portrait.error.' + e | t }}
        </p>
      }

      <input
        #file
        class="visually-hidden"
        type="file"
        accept="image/*"
        tabindex="-1"
        data-testid="portrait-file"
        [attr.aria-label]="'portrait.upload' | t"
        (change)="picked($event)"
      />
      <input
        #camera
        class="visually-hidden"
        type="file"
        accept="image/*"
        capture="user"
        tabindex="-1"
        [attr.aria-label]="'portrait.camera' | t"
        (change)="picked($event)"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      opacity: 0;
    }
    .main {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3) var(--space-4);
    }
    .buttons,
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .preview {
      position: relative;
      display: grid;
      place-items: center;
      flex: none;
      width: 7rem;
      height: 7rem;
      overflow: hidden;
      border-radius: 50%;
      background: var(--paper-2);
      border: 2px solid var(--brass, var(--accent-2));
      box-shadow:
        0 0 0 3px var(--card),
        0 0 0 4px var(--line-strong),
        var(--shadow-1);
    }
    .preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .none {
      padding: var(--space-2);
      font-family: var(--font-note);
      font-size: var(--fs-sm);
      font-style: italic;
      text-align: center;
      color: var(--ink-soft);
    }
    .frame-step {
      display: grid;
      gap: var(--space-2);
      justify-items: start;
    }
    .hint {
      margin: 0;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .viewport {
      position: relative;
      width: min(100%, 18rem);
      aspect-ratio: 1;
      overflow: hidden;
      touch-action: none;
      cursor: grab;
      background: var(--desk-2, #2e1b10);
      border: 2px solid var(--brass, var(--accent-2));
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-1);
      user-select: none;
    }
    .viewport:active {
      cursor: grabbing;
    }
    .viewport:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
    .source {
      position: absolute;
      max-width: none;
      height: auto;
      pointer-events: none;
    }
    .guide {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.5);
      outline: 2px solid rgb(255 244 220 / 0.85);
      outline-offset: -2px;
      pointer-events: none;
    }
    .viewport {
      clip-path: inset(0);
    }
    .zoom {
      display: grid;
      gap: var(--space-1);
      width: min(100%, 18rem);
      font-size: var(--fs-sm);
    }
    .zoom input {
      width: 100%;
      min-height: var(--tap, 2.75rem);
      accent-color: var(--accent);
    }
    .error {
      margin: var(--space-2) 0 0;
      color: var(--danger);
      font-weight: 700;
    }
  `,
})
export class PortraitPicker implements OnDestroy {
  /** The current portrait (data URL) or null. */
  readonly value = input<string | null | undefined>(null);
  /** For the image's alt text. */
  readonly name = input('');
  readonly valueChange = output<string | null>();

  protected readonly maxZoom = PORTRAIT_MAX_ZOOM;
  /** Phones/tablets: offer the camera next to the file chooser. */
  protected readonly touch =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  protected readonly pending = signal<Pending | null>(null);
  protected readonly framing = signal<Framing>({ ...CENTERED });
  protected readonly error = signal<PickError | null>(null);

  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;

  /** The image's CSS box inside the square viewport, in %: crop side = 100% of the viewport. */
  protected readonly imgStyle = computed(() => {
    const p = this.pending();
    if (!p) return { w: 100, x: 0, y: 0 };
    const { sx, sy, side } = cropRect(p.width, p.height, this.framing());
    return { w: (100 * p.width) / side, x: (-100 * sx) / side, y: (-100 * sy) / side };
  });

  ngOnDestroy(): void {
    this.release();
  }

  protected async picked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so picking the same file again still fires
    if (!file) return;
    this.error.set(null);
    const problem = checkPortraitFile(file);
    if (problem) {
      this.error.set(problem);
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty');
      this.release();
      this.framing.set({ ...CENTERED });
      this.pending.set({ url, img, width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      URL.revokeObjectURL(url);
      this.error.set('decode');
    }
  }

  protected apply(): void {
    const p = this.pending();
    if (!p) return;
    try {
      this.valueChange.emit(renderPortrait(p.img, p.width, p.height, this.framing()));
      this.cancel();
    } catch {
      this.error.set('decode');
    }
  }

  protected cancel(): void {
    this.release();
    this.pending.set(null);
  }

  protected remove(): void {
    this.error.set(null);
    this.valueChange.emit(null);
  }

  private release(): void {
    const p = this.pending();
    if (p) URL.revokeObjectURL(p.url);
    this.pointers.clear();
    this.pinch = 0;
  }

  // -- framing gestures ---------------------------------------------------------------------

  private viewSize(): number {
    return this.viewport()?.nativeElement.getBoundingClientRect().width || 288;
  }

  protected setZoom(zoom: number): void {
    const p = this.pending();
    if (p) this.framing.update((f) => zoomFraming(p.width, p.height, f, zoom));
  }

  protected down(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.pinch = this.pinchDistance();
  }

  protected move(e: PointerEvent): void {
    const prev = this.pointers.get(e.pointerId);
    const p = this.pending();
    if (!prev || !p) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      const d = this.pinchDistance();
      if (this.pinch > 0 && d > 0) {
        this.framing.update((f) => zoomFraming(p.width, p.height, f, f.zoom * (d / this.pinch)));
      }
      this.pinch = d;
      return;
    }
    const view = this.viewSize();
    this.framing.update((f) =>
      dragFraming(p.width, p.height, f, e.clientX - prev.x, e.clientY - prev.y, view),
    );
  }

  protected up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.pinch = this.pinchDistance();
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  protected wheel(e: WheelEvent): void {
    e.preventDefault();
    this.setZoom(this.framing().zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  protected key(e: KeyboardEvent): void {
    const p = this.pending();
    if (!p) return;
    const step = 12;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (e.key === '+' || e.key === '=') this.setZoom(this.framing().zoom * 1.1);
    else if (e.key === '-') this.setZoom(this.framing().zoom / 1.1);
    else if (delta[e.key]) {
      const [dx, dy] = delta[e.key];
      const view = this.viewSize();
      this.framing.update((f) => dragFraming(p.width, p.height, f, dx, dy, view));
    } else return;
    e.preventDefault();
  }
}
