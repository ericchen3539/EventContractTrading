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
  /** Fallback when close_time is "After the outcome occurs" (Conditional Closing: "Otherwise, it closes by ..."). */
  latest_expiration_time?: string;
  expiration_time?: string;
  /** Seconds after close_time until projected payout. Used to compute settlementDate when market is open. */
  settlement_timer_seconds?: number;
  /** Actual settlement timestamp when market is settled. Used for settlementDate when market is closed. */
  settlement_ts?: string;
  /** Text containing "Otherwise, it closes by Feb 28, 2026 at 11:59pm EST" when close_time is conditional. */
  early_close_condition?: string;
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

/** True if s parses to a valid Date (ISO or similar). Rejects "After the outcome occurs" etc. */
function isValidIsoTimestamp(s: string | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

/**
 * Parse "Otherwise, it closes by Feb 28, 2026 at 11:59pm EST" from early_close_condition.
 * Returns ISO string if parseable, else undefined.
 */
function parseOtherwiseFromEarlyCloseCondition(text: string | undefined): string | undefined {
  if (!text || typeof text !== "string") return undefined;
  const m = text.match(
    /otherwise[,\s]+(?:it\s+closes?\s+by\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}\s+at\s+[\d:]+(?:\s*(?:am|pm))?\s*(?:EST|EDT|PST|PDT|UTC|CST|CDT|MST|MDT)?)/i
  );
  if (!m) return undefined;
  const d = new Date(m[1].trim());
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Compute projected payout date (settlement date) from Kalshi market.
 * Rule: settlement_ts (if settled) -> close_time + settlement_timer_seconds (if open).
 */
function getSettlementDate(m: KalshiMarket): Date | undefined {
  const ts = m.settlement_ts;
  if (ts && isValidIsoTimestamp(ts)) return new Date(ts);
  const closeTs = getTradingCloseTs(m);
  if (!closeTs) return undefined;
  const timerSec = m.settlement_timer_seconds;
  if (typeof timerSec === "number" && timerSec >= 0) {
    const d = new Date(closeTs);
    d.setSeconds(d.getSeconds() + timerSec);
    return d;
  }
  return undefined;
}

/**
 * Extract trading close time per rule: close_time (if valid) -> latest_expiration_time (otherwise fallback) -> expiration_time.
 * When close_time is "After the outcome occurs", use latest_expiration_time or parse from early_close_condition.
 */
function getTradingCloseTs(m: KalshiMarket): string | undefined {
  if (isValidIsoTimestamp(m.close_time)) return m.close_time;
  if (isValidIsoTimestamp(m.latest_expiration_time)) return m.latest_expiration_time;
  const otherwiseTs = parseOtherwiseFromEarlyCloseCondition(m.early_close_condition);
  if (otherwiseTs) return otherwiseTs;
  if (isValidIsoTimestamp(m.expiration_time)) return m.expiration_time;
  return undefined;
}
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
      /** First market = soonest trading close time. Priority: close_time -> latest_expiration_time (otherwise) -> expiration_time. */
      const openMarkets = allMarkets.filter((m) => OPEN_MARKET_STATUSES.has(m.status));
      const SORT_AFTER_OUTCOME = "\uFFFF";
      const sortedByTradingClose = [...openMarkets].sort((a, b) => {
        const aTs = getTradingCloseTs(a) ?? SORT_AFTER_OUTCOME;
        const bTs = getTradingCloseTs(b) ?? SORT_AFTER_OUTCOME;
        return aTs.localeCompare(bTs);
      });
      /** Primary: soonest market. Include "After the outcome occurs" (no valid ts) as open. */
      const primary = sortedByTradingClose.find((m) => {
        const ts = getTradingCloseTs(m);
        if (!ts) return true; // "After the outcome occurs" = still open
        const deadline = new Date(ts);
        return deadline >= startOfTomorrow;
      });
      if (!primary) continue; // No open market; skip event
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

      /** First market's trading close time = 最近交易截止时间. Priority: close_time -> latest_expiration_time -> expiration_time. */
      const primaryCloseTs = primary ? getTradingCloseTs(primary) : undefined;
      const nextTradingCloseTime = primaryCloseTs ? new Date(primaryCloseTs) : undefined;
      /** Last market's end = 结束日期 (event fully resolves). */
      const lastCloseTs = lastMarket ? getTradingCloseTs(lastMarket) : undefined;
      const endDate = lastCloseTs ?? ev.strike_date;
      results.push({
        externalId: ev.event_ticker,
        sectionExternalId: category,
        title: ev.title,
        description: ev.sub_title ?? undefined,
        status: "open",
        nextTradingCloseTime,
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
  _eventTradingCloseTime: Date | null
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
    /** Trading deadline. Priority: close_time -> latest_expiration_time (otherwise) -> expiration_time. */
    const tradingCloseTs = getTradingCloseTs(m);

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

    const closeTime = tradingCloseTs ? new Date(tradingCloseTs) : undefined;
    const nextTradingCloseTime = closeTime;
    const settlementDate = getSettlementDate(m);

    results.push({
      externalId: m.ticker,
      title: m.title ?? m.ticker,
      status: m.status ?? undefined,
      closeTime,
      nextTradingCloseTime,
      settlementDate,
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
  const SORT_AFTER_OUTCOME = "\uFFFF";
  const sortedByTradingClose = [...(openMarkets.length ? openMarkets : markets)].sort((a, b) => {
    const aTs = getTradingCloseTs(a) ?? SORT_AFTER_OUTCOME;
    const bTs = getTradingCloseTs(b) ?? SORT_AFTER_OUTCOME;
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

  const primaryCloseTs = primary ? getTradingCloseTs(primary) : undefined;
  const nextTradingCloseTime = primaryCloseTs ? new Date(primaryCloseTs) : undefined;
  const lastCloseTs = lastMarket ? getTradingCloseTs(lastMarket) : undefined;
  const endDate = lastCloseTs ?? ev.strike_date;

  const category = ev.category ?? "World";

  return {
    externalId: ev.event_ticker,
    sectionExternalId: category,
    title: ev.title,
    description: ev.sub_title ?? undefined,
    status: primary?.status ?? "open",
    nextTradingCloseTime,
    endDate: endDate ? new Date(endDate) : undefined,
    volume: typeof volume === "number" ? volume : undefined,
    liquidity: typeof liquidity === "number" ? liquidity : undefined,
    outcomes: Object.keys(outcomes).length ? outcomes : undefined,
    raw: { event: ev, market: primary } as Record<string, unknown>,
  };
}

/**
 * Fetch a single market by ticker. Used for associating market positions with Market cache.
 * Calls GET /markets/{ticker} (public API).
 */
async function getMarketByTicker(
  _site: SiteInput,
  marketTicker: string
): Promise<{ market: MarketInput; eventTicker: string } | null> {
  let data: { market?: KalshiMarket };
  try {
    data = await fetchJson<{ market?: KalshiMarket }>(
      `${KALSHI_API_BASE}/markets/${encodeURIComponent(marketTicker)}`
    );
  } catch {
    return null;
  }

  const m = data.market;
  if (!m?.ticker || !m.event_ticker) return null;

  /** Priority: close_time -> latest_expiration_time (otherwise) -> expiration_time. */
  const tradingCloseTs = getTradingCloseTs(m);

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

  const closeTime = tradingCloseTs ? new Date(tradingCloseTs) : undefined;
  const nextTradingCloseTime = closeTime;
  const settlementDate = getSettlementDate(m);

  const market: MarketInput = {
    externalId: m.ticker,
    title: m.title ?? m.ticker,
    status: m.status ?? undefined,
    closeTime,
    nextTradingCloseTime,
    settlementDate,
    volume: typeof volume === "number" ? volume : undefined,
    liquidity: typeof liquidity === "number" ? liquidity : undefined,
    outcomes: Object.keys(outcomes).length ? outcomes : undefined,
    raw: { market: m } as Record<string, unknown>,
  };

  return { market, eventTicker: m.event_ticker };
}

export const kalshiAdapter: Adapter = {
  getSections,
  getEventsAndMarkets,
  getMarketsForEvent,
  getEventByTicker,
  getMarketByTicker,
};
