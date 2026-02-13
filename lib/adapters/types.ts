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
  /** First market's trading close time (交易截止时间 from Timeline and payout). */
  createdAt?: Date;
  endDate?: Date;
  volume?: number;
  liquidity?: number;
  outcomes?: Record<string, number>;
  raw?: Record<string, unknown>;
}

/** Market record for Market; adapter returns this shape before DB upsert. */
export interface MarketInput {
  externalId: string;
  title: string;
  closeTime?: Date;
  /** Trading deadline from Timeline and payout ("Otherwise, it closes by..."). For Kalshi: expiration_time ?? close_time. */
  tradingCloseTime?: Date;
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
   * Fetch all open markets for an event. Used to sync with the global Market table.
   * Compare adapter response with Market table (by externalId) to insert new / update changed.
   */
  getMarketsForEvent(
    site: SiteInput,
    eventExternalId: string,
    eventCreatedAt: Date | null
  ): Promise<MarketInput[]>;
}
