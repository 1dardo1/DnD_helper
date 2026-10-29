import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

/**
 * Markdown (descriptions from data/*.json) → HTML, for [innerHTML].
 * Angular sanitises the result when it's bound, so no script can get through.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(md: string | null | undefined): string {
    return md ? (marked.parse(md, { async: false, gfm: true }) as string) : '';
  }
}
