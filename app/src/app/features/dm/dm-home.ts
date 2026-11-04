import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '../../core/i18n/i18n.service';

/** A tool on the DM's table: where it lives, its title and line of description, and its icon. */
export interface DmTool {
  route: string;
  titleKey: string;
  descKey: string;
  /** Body of a 24×24 line drawing (SVG elements, stroke only), drawn in the card's ink. */
  icon: string;
}

/** The tools, in the order shown. Add one line per new tool. */
export const DM_TOOLS: DmTool[] = [
  {
    route: '/dm/encounters',
    titleKey: 'dm.encounters.title',
    descKey: 'dm.encounters.desc',
    // two crossed swords
    icon: "<path d='M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2'/>",
  },
];

/** Builds the mask image of a tool's icon. */
export function iconUrl(body: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** "Mesa del DM": the Dungeon Master's tools. */
@Component({
  selector: 'app-dm-home',
  imports: [RouterLink, TranslatePipe],
  template: `
    <h1>{{ 'dm.title' | t }}</h1>
    <p>{{ 'dm.intro' | t }}</p>
    <ul class="tools">
      @for (tool of tools; track tool.route) {
        <li>
          <span class="icon" aria-hidden="true" [style.--icon]="icon(tool)"></span>
          <a [routerLink]="tool.route">{{ tool.titleKey | t }}</a>
          <span class="desc">{{ tool.descKey | t }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .tools {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
      gap: var(--space-4);
      padding: 0;
      list-style: none;
    }
    li {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-1) var(--space-3);
      align-items: center;
      margin: 0;
      padding: var(--space-4) var(--space-4) var(--space-4) var(--space-5);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 3px var(--radius-md) var(--radius-md) 3px;
      box-shadow: var(--shadow-1);
    }
    /* the ribbon colour of the section on the left edge */
    li::before {
      content: '';
      position: absolute;
      inset: -1px auto -1px -1px;
      width: 0.5rem;
      border-radius: 3px 0 0 3px;
      background: var(--ribbon-dm, #1d5656);
    }
    .icon {
      grid-row: span 2;
      width: 2.25rem;
      height: 2.25rem;
      background-color: var(--accent);
      mask: var(--icon) center / contain no-repeat;
    }
    a {
      font-family: var(--font-title);
      font-size: var(--fs-xl);
      font-weight: 700;
      line-height: 1.2;
      text-decoration: none;
    }
    a::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .desc {
      color: var(--ink-soft);
    }
    li:hover {
      border-color: var(--line-strong);
      box-shadow: var(--shadow-2);
    }
    li:focus-within {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
    a:focus-visible {
      outline: none;
    }
  `,
})
export class DmHome {
  protected readonly tools = DM_TOOLS;

  protected icon(tool: DmTool): string {
    return iconUrl(tool.icon);
  }
}
