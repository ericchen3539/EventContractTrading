/**
 * Kalshi adapter: fetches series (sections) and events/markets via public API.
 * No authentication required for read operations.
 * @see https://docs.kalshi.com
 */
import type {
  Adapter,
  EventMarketInput,
  MarketInput,
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

/** Kalshi uses "active" for open markets, not "open". */
const OPEN_MARKET_STATUSES = new Set(["open", "active"]);

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
/** Delay between paginated requests to avoid 429 (Basic tier ~20 req/s). */
const REQUEST_DELAY_MS = 80;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN;
        const waitMs =
          Number.isNaN(parsed) || parsed <= 0
            ? RETRY_BASE_MS * Math.pow(2, attempt)
            : Math.min(parsed * 1000, 30_000);
        if (attempt < MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
      }
      if (!res.ok) {
        throw new Error(`Kalshi API error: ${res.status} ${res.statusText}`);
      }
      return res.json() as Promise<T>;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        lastErr = new Error("Kalshi API request timed out");
      } else {
        lastErr = err instanceof Error ? err : new Error(String(err));
      }
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new Error("Kalshi API request failed");
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
  let isFirstPage = true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(today);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  do {
    if (!isFirstPage) await sleep(REQUEST_DELAY_MS);
    isFirstPage = false;

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

      const allMarkets = ev.markets ?? [];
      /** First market = soonest trading close time (expiration_time ?? close_time). Kalshi uses status "active". */
      const openMarkets = allMarkets.filter((m) => OPEN_MARKET_STATUSES.has(m.status));
      const sortedByTradingClose = [...openMarkets].sort((a, b) => {
        const aTs = a.expiration_time ?? a.close_time ?? "";
        const bTs = b.expiration_time ?? b.close_time ?? "";
        return aTs.localeCompare(bTs);
      });
      /** Primary must have trading deadline > today (user's operation date). Skip past markets. */
      const primary = sortedByTradingClose.find((m) => {
        const ts = m.expiration_time ?? m.close_time;
        if (!ts) return false;
        const deadline = new Date(ts);
        return deadline >= startOfTomorrow;
      });
      if (!primary) continue; // No market with deadline > today; skip event
      const lastMarket =
        sortedByTradingClose.length > 1 ? sortedByTradingClose[sortedByTradingClose.length - 1] : primary;
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

      /** First market's trading close time = 最近交易截止时间 (soonest "Otherwise, it closes by..."). */
      const createdAt =
        primary?.expiration_time
          ? new Date(primary.expiration_time)
          : primary?.close_time
            ? new Date(primary.close_time)
            : undefined;
      /** Last market's end = 结束日期 (event fully resolves). */
      const endDate =
        lastMarket?.close_time ?? lastMarket?.expiration_time ?? ev.strike_date;
      results.push({
        externalId: ev.event_ticker,
        sectionExternalId: category,
        title: ev.title,
        description: ev.sub_title ?? undefined,
        status: "open",
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

/**
 * Fetch all markets for an event. Used to sync with the global Market table.
 * Tries GET /events/{event_ticker}?with_nested_markets=true first; if empty, falls back to GET /markets?event_ticker=xxx.
 */
async function getMarketsForEvent(
  _site: SiteInput,
  eventExternalId: string,
  _eventCreatedAt: Date | null
): Promise<MarketInput[]> {
  const eventUrl = `${KALSHI_API_BASE}/events/${encodeURIComponent(eventExternalId)}?with_nested_markets=true`;
  const eventData = await fetchJson<{ event?: KalshiEvent; markets?: KalshiMarket[] }>(eventUrl);

  const event = eventData.event;
  let markets = eventData.markets ?? event?.markets ?? [];

  if (markets.length === 0) {
    const marketsUrl = `${KALSHI_API_BASE}/markets?event_ticker=${encodeURIComponent(eventExternalId)}&limit=200`;
    const marketsData = await fetchJson<{ markets?: KalshiMarket[] }>(marketsUrl);
    markets = marketsData.markets ?? [];
  }
  const results: MarketInput[] = [];
  for (const m of markets) {
    if (!m.ticker) continue;
    const ts = m.close_time ?? m.expiration_time;
    /** Trading deadline from "Otherwise, it closes by..." in Timeline and payout. Prefer expiration_time. */
    const tradingCloseTs = m.expiration_time ?? m.close_time;

    const volume = m.volume ?? 0;
    const liquidityRaw = m.liquidity_dollars ?? m.liquidity;
    const liquidity =
      typeof liquidityRaw === "string"
        ? parseFloat(liquidityRaw)
        : typeof liquidityRaw === "number"
          ? liquidityRaw / 100
          : undefined;

    const yesPrice =
      m.last_price_dollars ?? m.yes_ask_dollars ?? m.yes_bid_dollars;
    const yesVal = yesPrice ? parseFloat(String(yesPrice)) : undefined;
    const noVal = yesVal !== undefined ? 1 - yesVal : undefined;

    const outcomes: Record<string, number> = {};
    if (yesVal !== undefined) outcomes.Yes = yesVal;
    if (noVal !== undefined) outcomes.No = noVal;

    const closeTime = ts ? new Date(ts) : undefined;
    const tradingCloseTime = tradingCloseTs ? new Date(tradingCloseTs) : undefined;

    results.push({
      externalId: m.ticker,
      title: m.title ?? m.ticker,
      status: m.status ?? undefined,
      closeTime,
      tradingCloseTime,
      volume: typeof volume === "number" ? volume : undefined,
      liquidity: typeof liquidity === "number" ? liquidity : undefined,
      outcomes: Object.keys(outcomes).length ? outcomes : undefined,
      raw: { market: m, event } as Record<string, unknown>,
    });
  }
  return results;
}

/**
 * Fetch a single event by ticker. Used for associating event positions with EventCache.
 * Returns EventMarketInput or null if event not found.
 */
async function getEventByTicker(
  _site: SiteInput,
  eventTicker: string
): Promise<EventMarketInput | null> {
  const eventUrl = `${KALSHI_API_BASE}/events/${encodeURIComponent(eventTicker)}?with_nested_markets=true`;
  let eventData: { event?: KalshiEvent; markets?: KalshiMarket[] };
  try {
    eventData = await fetchJson<{ event?: KalshiEvent; markets?: KalshiMarket[] }>(eventUrl);
  } catch {
    return null;
  }

  const ev = eventData.event;
  if (!ev) return null;

  let markets = eventData.markets ?? ev.markets ?? [];
  if (markets.length === 0) {
    const marketsUrl = `${KALSHI_API_BASE}/markets?event_ticker=${encodeURIComponent(eventTicker)}&limit=200`;
    try {
      const marketsData = await fetchJson<{ markets?: KalshiMarket[] }>(marketsUrl);
      markets = marketsData.markets ?? [];
    } catch {
      // Proceed with empty markets
    }
  }

  const openMarkets = markets.filter((m) => OPEN_MARKET_STATUSES.has(m.status));
  const sortedByTradingClose = [...(openMarkets.length ? openMarkets : markets)].sort((a, b) => {
    const aTs = a.expiration_time ?? a.close_time ?? "";
    const bTs = b.expiration_time ?? b.close_time ?? "";
    return aTs.localeCompare(bTs);
  });
  const primary = sortedByTradingClose[0];
  const lastMarket = sortedByTradingClose.length > 1 ? sortedByTradingClose[sortedByTradingClose.length - 1] : primary;

  const volume = primary?.volume ?? 0;
  const liquidityRaw = primary?.liquidity_dollars ?? primary?.liquidity;
  const liquidity =
    typeof liquidityRaw === "string"
      ? parseFloat(liquidityRaw)
      : typeof liquidityRaw === "number"
        ? liquidityRaw / 100
        : undefined;

  const yesPrice =
    primary?.last_price_dollars ?? primary?.yes_ask_dollars ?? primary?.yes_bid_dollars;
  const yesVal = yesPrice ? parseFloat(String(yesPrice)) : undefined;
  const noVal = yesVal !== undefined ? 1 - yesVal : undefined;

  const outcomes: Record<string, number> = {};
  if (yesVal !== undefined) outcomes.Yes = yesVal;
  if (noVal !== undefined) outcomes.No = noVal;

  const createdAt =
    primary?.expiration_time
      ? new Date(primary.expiration_time)
      : primary?.close_time
        ? new Date(primary.close_time)
        : undefined;
  const endDate =
    lastMarket?.close_time ?? lastMarket?.expiration_time ?? ev.strike_date;

  const category = ev.category ?? "World";

  return {
    externalId: ev.event_ticker,
    sectionExternalId: category,
    title: ev.title,
    description: ev.sub_title ?? undefined,
    status: primary?.status ?? "open",
    createdAt,
    endDate: endDate ? new Date(endDate) : undefined,
    volume: typeof volume === "number" ? volume : undefined,
    liquidity: typeof liquidity === "number" ? liquidity : undefined,
    outcomes: Object.keys(outcomes).length ? outcomes : undefined,
    raw: { event: ev, market: primary } as Record<string, unknown>,
  };
}

export const kalshiAdapter: Adapter = {
  getSections,
  getEventsAndMarkets,
  getMarketsForEvent,
  getEventByTicker,
};
