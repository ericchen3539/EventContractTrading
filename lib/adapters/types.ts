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
  /** Section externalId (e.g. series_ticker) for upsert into EventCache.sectionId. */
  sectionExternalId: string;
  title: string;
  description?: string;
  /** First market's trading end time (close_time or expiration_time). */
  createdAt?: Date;
  endDate?: Date;
  volume?: number;
  liquidity?: number;
  outcomes?: Record<string, number>;
  raw?: Record<string, unknown>;
}

/** Market record for MarketCache; adapter returns this shape before DB upsert. */
export interface MarketInput {
  externalId: string;
  title: string;
  closeTime?: Date;
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

  /**
   * Fetch markets for an event whose close_time equals the event's closest trading end time.
   * Filters markets where close_time === eventCreatedAt.
   */
  getMarketsForEvent(
    site: SiteInput,
    eventExternalId: string,
    eventCreatedAt: Date | null
  ): Promise<MarketInput[]>;
}
