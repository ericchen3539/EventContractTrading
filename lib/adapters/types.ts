/**
 * Adapter types for multi-platform event/market data.
 * Each platform implements the Adapter interface and is routed via Site.adapterKey.
 */

/** Site model shape passed to adapters (read-only subset). */
export interface SiteInput {
  id: string;
  baseUrl: string;
  adapterKey: string;
}

/** Section metadata returned by adapters; externalId maps to platform identifier (e.g. series_ticker). */
export interface SectionInput {
  externalId: string;
  name: string;
  urlOrSlug?: string;
}

/** Event/market record for EventCache; adapter returns this shape before DB upsert. */
export interface EventMarketInput {
  externalId: string;
  title: string;
  description?: string;
  endDate?: Date;
  volume?: number;
  liquidity?: number;
  outcomes?: Record<string, number>;
  raw?: Record<string, unknown>;
}

export interface Adapter {
  /** Fetch available sections for the site (no login required for Kalshi). */
  getSections(site: SiteInput): Promise<SectionInput[]>;

  /** Fetch events and markets for the given sections; sectionIds are externalIds. */
  getEventsAndMarkets(
    site: SiteInput,
    sectionIds: string[]
  ): Promise<EventMarketInput[]>;
}
