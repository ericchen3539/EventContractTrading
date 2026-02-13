/**
 * Shared API response transformers.
 * Strips internal fields and serializes dates for JSON responses.
 */

export type PublicSite = {
  id: string;
  userId: string;
  name: string;
  baseUrl: string;
  adapterKey: string;
  hasCredentials: boolean;
  /** True when apiKeyId and apiKeyPrivateKey are set (Kalshi trading data). */
  hasApiKey: boolean;
  createdAt: string;
};

export function toPublicSite(site: {
  id: string;
  userId: string;
  name: string;
  baseUrl: string;
  adapterKey: string;
  loginUsername?: string | null;
  loginPassword?: string | null;
  apiKeyId?: string | null;
  apiKeyPrivateKey?: string | null;
  createdAt: Date;
}): PublicSite {
  return {
    id: site.id,
    userId: site.userId,
    name: site.name,
    baseUrl: site.baseUrl,
    adapterKey: site.adapterKey,
    hasCredentials: !!(
      site.loginUsername ||
      site.loginPassword ||
      site.apiKeyId ||
      site.apiKeyPrivateKey
    ),
    hasApiKey: !!(site.apiKeyId && site.apiKeyPrivateKey),
    createdAt: site.createdAt.toISOString(),
  };
}

export type PublicEvent = {
  id: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  description?: string;
  nextTradingCloseTime?: string;
  endDate?: string;
  volume?: number;
  liquidity?: number;
  outcomes?: unknown;
  fetchedAt: string;
};

export function toPublicEvent(event: {
  id: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  description: string | null;
  nextTradingCloseTime: Date | null;
  endDate: Date | null;
  volume: number | null;
  liquidity: number | null;
  outcomes: unknown;
  fetchedAt: Date;
}): PublicEvent {
  return {
    id: event.id,
    siteId: event.siteId,
    sectionId: event.sectionId,
    externalId: event.externalId,
    title: event.title,
    description: event.description ?? undefined,
    nextTradingCloseTime: event.nextTradingCloseTime?.toISOString() ?? undefined,
    endDate: event.endDate?.toISOString() ?? undefined,
    volume: event.volume ?? undefined,
    liquidity: event.liquidity ?? undefined,
    outcomes: event.outcomes ?? undefined,
    fetchedAt: event.fetchedAt.toISOString(),
  };
}
