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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`Kalshi API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch all series in the politics category as sections. */
async function getSections(_site: SiteInput): Promise<SectionInput[]> {
  const url = `${KALSHI_API_BASE}/series?category=Politics`;
  const data = await fetchJson<KalshiSeriesResponse>(url);

  if (!data.series || !Array.isArray(data.series)) {
    return [];
  }

  return data.series.map((s) => ({
    externalId: s.ticker,
    name: s.title || s.ticker,
    urlOrSlug: s.contract_url ?? undefined,
  }));
}

/** Fetch events for given series tickers; maps to EventMarketInput. */
async function getEventsAndMarkets(
  _site: SiteInput,
  sectionIds: string[]
): Promise<EventMarketInput[]> {
  const results: EventMarketInput[] = [];

  for (const seriesTicker of sectionIds) {
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({
        series_ticker: seriesTicker,
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
        results.push({
          externalId: ev.event_ticker,
          title: ev.title,
          description: ev.sub_title ?? undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          volume: typeof volume === "number" ? volume : undefined,
          liquidity: typeof liquidity === "number" ? liquidity : undefined,
          outcomes: Object.keys(outcomes).length ? outcomes : undefined,
          raw: { event: ev, market: primary } as Record<string, unknown>,
        });
      }

      cursor = data.cursor || undefined;
    } while (cursor);
  }

  return results;
}

export const kalshiAdapter: Adapter = {
  getSections,
  getEventsAndMarkets,
};
