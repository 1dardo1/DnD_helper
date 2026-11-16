import { TestBed } from '@angular/core/testing';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { RepositoryService } from '../../core/data/repository.service';
import { LoadError } from './load-error';

function mount(error: unknown, retryable: boolean) {
  const retried = { compendium: 0 };
  TestBed.configureTestingModule({
    providers: [
      { provide: RepositoryService, useValue: { source: () => ({ kind: 'github' }) } },
      { provide: CompendiumService, useValue: { retry: () => retried.compendium++ } },
    ],
  });
  const fixture = TestBed.createComponent(LoadError);
  fixture.componentRef.setInput('error', error);
  fixture.componentRef.setInput('retryable', retryable);
  let emitted = 0;
  fixture.componentInstance.retry.subscribe(() => emitted++);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, retried, emitted: () => emitted };
}

describe('LoadError', () => {
  it('shows the friendly "no connection" notice with Retry for a download error', () => {
    const m = mount(new Error('network error (Failed to fetch)'), true);
    expect(m.el.querySelector('.no-connection')).not.toBeNull();
    m.el.querySelector('button')!.click();
    expect(m.retried.compendium).toBe(1);
    expect(m.emitted()).toBe(1);
  });

  it('has no Retry button when the page does not reload', () => {
    const m = mount(new Error('Failed to fetch'), false);
    expect(m.el.querySelector('.no-connection')).not.toBeNull();
    expect(m.el.querySelector('button')).toBeNull();
  });

  it('shows any other error as it is', () => {
    const m = mount(new Error('Unexpected token < in JSON'), true);
    expect(m.el.querySelector('.no-connection')).toBeNull();
    expect(m.el.textContent).toContain('Unexpected token');
  });
});
