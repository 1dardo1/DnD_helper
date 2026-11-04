import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { PICTURE_BASES, PictureKind } from '../../core/media/pictures';
import { EntryPictures, EntryPortrait } from './entry-portrait';

const REMOTE = 'https://example.github.io/DnD_helper/monsters/';

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** fetch answering each index.json URL with its list (404 for the others). */
function fakeFetch(indexes: Record<string, unknown>) {
  return vi.fn(async (url: string) => (url in indexes ? reply(200, indexes[url]) : reply(404, {})));
}

@Component({
  imports: [EntryPortrait],
  template: `<app-entry-portrait [kind]="kind()" [entryId]="id()" alt="pic" />`,
})
class Host {
  readonly kind = input<PictureKind>('monster');
  readonly id = input('owlbear');
}

describe('EntryPictures', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PICTURE_BASES, useValue: { species: 'species/', monster: REMOTE } }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads each kind’s index once and only gives URLs of listed pictures', async () => {
    const fetchFn = fakeFetch({
      'species/index.json': ['elf'],
      [`${REMOTE}index.json`]: ['owlbear', 'goblin-warrior', 42],
    });
    vi.stubGlobal('fetch', fetchFn);
    const pictures = TestBed.inject(EntryPictures);

    expect(pictures.src('monster', 'owlbear')).toBeNull(); // not known yet
    await pictures.load('monster');
    expect(pictures.src('monster', 'owlbear')).toBe(`${REMOTE}owlbear.webp`);
    expect(pictures.src('monster', 'goblin-warrior')).toBe(`${REMOTE}goblin-warrior.webp`);
    expect(pictures.src('monster', 'lich')).toBeNull();
    expect(pictures.src('monster', 'elf')).toBeNull(); // each kind has its own list

    await pictures.load('species');
    expect(pictures.src('species', 'elf')).toBe('species/elf.webp');
    expect(pictures.src('species', 'owlbear')).toBeNull();

    pictures.src('monster', 'owlbear');
    pictures.src('species', 'elf');
    expect(fetchFn.mock.calls.map(([u]) => u)).toEqual([
      `${REMOTE}index.json`,
      'species/index.json',
    ]);
  });

  it('no index (not published yet) or offline: no pictures, no errors', async () => {
    vi.stubGlobal('fetch', fakeFetch({}));
    const pictures = TestBed.inject(EntryPictures);
    await pictures.load('monster');
    expect(pictures.src('monster', 'owlbear')).toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PICTURE_BASES, useValue: { species: 'species/', monster: REMOTE } }],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const offline = TestBed.inject(EntryPictures);
    await offline.load('monster');
    expect(offline.src('monster', 'owlbear')).toBeNull();
  });

  it('a broken index is ignored', async () => {
    vi.stubGlobal('fetch', fakeFetch({ [`${REMOTE}index.json`]: { owlbear: true } }));
    const pictures = TestBed.inject(EntryPictures);
    await pictures.load('monster');
    expect(pictures.src('monster', 'owlbear')).toBeNull();
  });
});

describe('EntryPortrait', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PICTURE_BASES, useValue: { species: 'species/', monster: REMOTE } }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the picture when listed, nothing otherwise, and hides it if it fails to load', async () => {
    vi.stubGlobal('fetch', fakeFetch({ [`${REMOTE}index.json`]: ['owlbear'] }));
    const fixture = TestBed.createComponent(Host);
    await TestBed.inject(EntryPictures).load('monster');
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('app-entry-portrait') as HTMLElement;
    const img = host.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(`${REMOTE}owlbear.webp`);
    expect(img.alt).toBe('pic');
    expect(host.classList).toContain('monster');
    expect(host.classList).not.toContain('empty');

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(host.querySelector('img')).toBeNull();
    expect(host.classList).toContain('empty');

    fixture.componentRef.setInput('id', 'lich');
    fixture.detectChanges();
    expect(host.querySelector('img')).toBeNull();
    expect(host.classList).toContain('empty');
  });
});
