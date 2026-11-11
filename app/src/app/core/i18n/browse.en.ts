/**
 * UI texts of the browsing helpers of the compendium and the DM's table (back to top, quick
 * filters, "on this page", share, recently viewed), in English. Like combat.en.ts, they travel
 * with the lazily loaded pages that use them (I18nService.extend) instead of the first load of the
 * app; browse.es.ts has the same keys.
 */
export const browseEn = {
  'browse.backToTop': 'Back to top',
  'browse.quickBy': 'Quick filter: {facet}',
  'browse.quickAll': 'All',
  'browse.onThisPage': 'On this page',
  'browse.share': 'Share',
  'browse.copyLink': 'Copy link',
  'browse.linkCopied': 'Link copied',
  'browse.recent': 'Recently viewed',
  'browse.clearRecent': 'Clear the recently viewed list',
  'browse.challenge': 'Challenge',
};

/** A key of these texts. */
export type BrowseKey = keyof typeof browseEn;
