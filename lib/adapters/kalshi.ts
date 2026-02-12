/**
 * Kalshi adapter: fetches series (sections) and events/markets via public API.
 * No authentication required for read operations.
 * @see https://docs.kalshi.com
 */
import type {
  Adapter,
  EventMarketInput,
  SectionInput,
  SiteInput,
} from "./types";

const KALSHI_API_BASE = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiSeries {
  ticker: string;
  title: string;
  category?: string;
  contract_url?: string;
  tags?: string[];
}

interface KalshiEventsResponse {
  events: KalshiEvent[];
  cursor?: string;
}

interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  sub_title?: string;
  strike_date?: string;
  category?: string;
  markets?: KalshiMarket[];
}

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  status: string;
  created_time?: string;
  close_time?: string;
  expiration_time?: string;
  volume?: number;
  volume_fp?: string;
  liquidity?: number;
  liquidity_dollars?: string;
  yes_bid?: number;
  yes_ask?: number;
  last_price?: number;
  last_price_dollars?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
}

interface KalshiSeriesResponse {
  series: KalshiSeries[];
}

const FETCH_TIMEOUT_MS = 15_000;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store", // Always fetch fresh data; revalidate can cause stale/weird behavior in Route Handlers
    });
    if (!res.ok) {
      throw new Error(`Kalshi API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Kalshi API request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Kalshi top-level categories matching site navigation.
 * externalId = API category name for event filtering; name = display label.
 */
const KALSHI_SECTIONS: SectionInput[] = [
  { externalId: "Sports", name: "Sports" },
  { externalId: "Politics", name: "Politics" },
  { externalId: "Entertainment", name: "Culture" },
  { externalId: "Crypto", name: "Crypto" },
  { externalId: "Climate and Weather", name: "Climate" },
  { externalId: "Economics", name: "Economics" },
  { externalId: "Mentions", name: "Mentions" },
  { externalId: "Companies", name: "Companies" },
  { externalId: "Financials", name: "Financials" },
  { externalId: "Science and Technology", name: "Tech & Science" },
  { externalId: "Elections", name: "Elections" },
  { externalId: "World", name: "World" },
  { externalId: "Health", name: "Health" },
];

/** Return top-level categories as sections (Trending, Sports, Politics, etc.). */
async function getSections(_site: SiteInput): Promise<SectionInput[]> {
  return KALSHI_SECTIONS;
}

/** Fetch events for given categories (sectionIds = API category names); filter by event.category. */
async function getEventsAndMarkets(
  _site: SiteInput,
  categoryIds: string[]
): Promise<EventMarketInput[]> {
  const categorySet = new Set(categoryIds);
  const results: EventMarketInput[] = [];

  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({
      status: "open",
      with_nested_markets: "true",
      limit: "200",
    });
    if (cursor) params.set("cursor", cursor);

    const url = `${KALSHI_API_BASE}/events?${params}`;
    const data = await fetchJson<KalshiEventsResponse>(url);

    if (!data.events || !Array.isArray(data.events)) {
      break;
    }

    for (const ev of data.events) {
      const category = ev.category;
      if (!category || !categorySet.has(category)) continue;

      const primary = ev.markets?.[0];
      const volume = primary?.volume ?? 0;
      const liquidityRaw = primary?.liquidity_dollars ?? primary?.liquidity;
      const liquidity =
        typeof liquidityRaw === "string"
          ? parseFloat(liquidityRaw)
          : typeof liquidityRaw === "number"
            ? liquidityRaw / 100
            : undefined;

      const yesPrice =
        primary?.last_price_dollars ??
        primary?.yes_ask_dollars ??
        primary?.yes_bid_dollars;
      const yesVal = yesPrice ? parseFloat(yesPrice) : undefined;
      const noVal = yesVal !== undefined ? 1 - yesVal : undefined;

      const outcomes: Record<string, number> = {};
      if (yesVal !== undefined) outcomes.Yes = yesVal;
      if (noVal !== undefined) outcomes.No = noVal;

      const endDate = primary?.close_time ?? primary?.expiration_time ?? ev.strike_date;
      const createdAt = primary?.created_time ? new Date(primary.created_time) : undefined;
      results.push({
        externalId: ev.event_ticker,
        sectionExternalId: category,
        title: ev.title,
        description: ev.sub_title ?? undefined,
        createdAt,
        endDate: endDate ? new Date(endDate) : undefined,
        volume: typeof volume === "number" ? volume : undefined,
        liquidity: typeof liquidity === "number" ? liquidity : undefined,
        outcomes: Object.keys(outcomes).length ? outcomes : undefined,
        raw: { event: ev, market: primary } as Record<string, unknown>,
      });
    }

    cursor = data.cursor || undefined;
  } while (cursor);

  return results;
}

export const kalshiAdapter: Adapter = {
  getSections,
  getEventsAndMarkets,
};
