/**
 * Kalshi authenticated portfolio API: balance, positions, fills, settlements.
 * Requires API Key ID + RSA private key (PEM) for signature.
 * @see https://docs.kalshi.com/getting_started/quick_start_authenticated_requests
 */
import { sign, createPrivateKey, constants } from "node:crypto";
import forge from "node-forge";

const { RSA_PKCS1_PSS_PADDING, RSA_PSS_SALTLEN_DIGEST } = constants;

/** Normalize PEM: ensure Unix line endings. */
function normalizePem(pem: string): string {
  return pem.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/**
 * Convert PKCS#1 (BEGIN RSA PRIVATE KEY) to PKCS#8 (BEGIN PRIVATE KEY).
 * Node.js OpenSSL 3 does not support PKCS#1 by default; node-forge can parse and convert.
 */
function convertPkcs1ToPkcs8(pem: string): string {
  const privateKey = forge.pki.privateKeyFromPem(pem);
  return forge.pki.privateKeyToPem(privateKey);
}

/** Derive Kalshi API base URL from site baseUrl. */
export function getKalshiApiBase(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    const host = u.hostname.toLowerCase();
    if (host.includes("demo")) {
      return "https://demo-api.kalshi.co/trade-api/v2";
    }
    if (host.includes("elections")) {
      return "https://api.elections.kalshi.com/trade-api/v2";
    }
    /** Default to elections API (same as events adapter); api.kalshi.com may be unreachable in some regions. */
    return "https://api.elections.kalshi.com/trade-api/v2";
  } catch {
    return "https://api.elections.kalshi.com/trade-api/v2";
  }
}

/**
 * Create Kalshi request signature. Message: timestamp + method + path (no query params).
 * Signs with RSA-PSS SHA256, returns base64.
 * Auto-converts PKCS#1 to PKCS#8 when Node.js OpenSSL 3 rejects the key.
 */
export function signKalshiRequest(
  privateKeyPem: string,
  timestamp: string,
  method: string,
  path: string
): string {
  const pathWithoutQuery = path.split("?")[0];
  const message = `${timestamp}${method}${pathWithoutQuery}`;
  const normalizedPem = normalizePem(privateKeyPem);

  let keyObject: ReturnType<typeof createPrivateKey>;
  try {
    keyObject = createPrivateKey({
      key: normalizedPem,
      format: "pem",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("DECODER") || msg.includes("unsupported")) {
      try {
        const pkcs8Pem = convertPkcs1ToPkcs8(normalizedPem);
        keyObject = createPrivateKey({ key: pkcs8Pem, format: "pem" });
      } catch (convertErr) {
        throw new Error(
          "私钥格式不受支持。请将 PKCS#1 密钥转换为 PKCS#8：openssl pkcs8 -topk8 -nocrypt -in key.pem -out key_pkcs8.pem，然后粘贴 key_pkcs8.pem 的内容。"
        );
      }
    } else {
      throw err;
    }
  }

  const sig = sign("sha256", Buffer.from(message, "utf8"), {
    key: keyObject,
    padding: RSA_PKCS1_PSS_PADDING,
    saltLength: RSA_PSS_SALTLEN_DIGEST,
  });
  return sig.toString("base64");
}

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Make an authenticated GET request to Kalshi portfolio API.
 * Path for signing must include /trade-api/v2 prefix per Kalshi docs.
 */
export async function fetchKalshiAuthenticated<T>(
  apiBase: string,
  apiKeyId: string,
  privateKeyPem: string,
  path: string
): Promise<T> {
  const timestamp = String(Date.now());
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const pathForSigning = new URL(apiBase).pathname.replace(/\/$/, "") + requestPath;
  const signature = signKalshiRequest(privateKeyPem, timestamp, "GET", pathForSigning);

  const url = apiBase.endsWith("/") ? `${apiBase.slice(0, -1)}${requestPath}` : `${apiBase}${requestPath}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "KALSHI-ACCESS-KEY": apiKeyId,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "KALSHI-ACCESS-SIGNATURE": signature,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kalshi API ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timeoutId);
    const cause = err instanceof Error && "cause" in err ? (err as { cause?: Error }).cause : undefined;
    const causeMsg = cause instanceof Error ? cause.message : cause != null ? String(cause) : "";
    const detail = causeMsg ? ` (${causeMsg})` : "";
    throw new Error(`fetch failed${detail}`, { cause: err });
  }
}

/** Fetch all pages for a paginated endpoint. */
async function fetchAllPages<T, R>(
  apiBase: string,
  apiKeyId: string,
  privateKeyPem: string,
  path: string,
  extractItems: (data: T) => R[],
  getCursor: (data: T) => string | undefined
): Promise<R[]> {
  const results: R[] = [];
  let cursor: string | undefined;
  const limit = 200;

  do {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    const fullPath = `${path}?${params}`;

    const data = await fetchKalshiAuthenticated<T>(apiBase, apiKeyId, privateKeyPem, fullPath);
    results.push(...extractItems(data));
    cursor = getCursor(data);
  } while (cursor);

  return results;
}

export interface KalshiBalance {
  balance: number;
  portfolio_value: number;
  updated_ts: number;
}

export interface KalshiMarketPosition {
  ticker: string;
  total_traded?: number;
  total_traded_dollars?: string;
  position?: number;
  position_fp?: string;
  market_exposure?: number;
  market_exposure_dollars?: string;
  realized_pnl?: number;
  realized_pnl_dollars?: string;
  resting_orders_count?: number;
  fees_paid?: number;
  fees_paid_dollars?: string;
  last_updated_ts?: string;
}

export interface KalshiEventPosition {
  event_ticker: string;
  total_cost?: number;
  total_cost_dollars?: string;
  total_cost_shares?: number;
  total_cost_shares_fp?: string;
  event_exposure?: number;
  event_exposure_dollars?: string;
  realized_pnl?: number;
  realized_pnl_dollars?: string;
  fees_paid?: number;
  fees_paid_dollars?: string;
}

export interface KalshiPositionsResponse {
  market_positions: KalshiMarketPosition[];
  event_positions: KalshiEventPosition[];
  cursor?: string;
}

export interface KalshiFill {
  fill_id: string;
  trade_id?: string;
  order_id?: string;
  ticker?: string;
  market_ticker?: string;
  side?: string;
  action?: string;
  count?: number;
  count_fp?: string;
  price?: number;
  yes_price?: number;
  no_price?: number;
  yes_price_fixed?: string;
  no_price_fixed?: string;
  is_taker?: boolean;
  fee_cost?: string;
  client_order_id?: string;
  created_time?: string;
  subaccount_number?: number;
  ts?: number;
}

export interface KalshiFillsResponse {
  fills: KalshiFill[];
  cursor?: string;
}

export interface KalshiSettlement {
  ticker: string;
  event_ticker?: string;
  market_result?: string;
  yes_count?: number;
  yes_count_fp?: string;
  yes_total_cost?: number;
  no_count?: number;
  no_count_fp?: string;
  no_total_cost?: number;
  revenue?: number;
  settled_time?: string;
  fee_cost?: string;
  value?: number;
}

export interface KalshiSettlementsResponse {
  settlements: KalshiSettlement[];
  cursor?: string;
}

export interface KalshiTradingData {
  balance: KalshiBalance | null;
  marketPositions: KalshiMarketPosition[];
  eventPositions: KalshiEventPosition[];
  fills: KalshiFill[];
  settlements: KalshiSettlement[];
}

/**
 * Fetch all trading data for a Kalshi account.
 */
export async function fetchKalshiTradingData(
  apiBase: string,
  apiKeyId: string,
  privateKeyPem: string
): Promise<KalshiTradingData> {
  const [balance, positionsData, fills, settlements] = await Promise.all([
    fetchKalshiAuthenticated<KalshiBalance>(apiBase, apiKeyId, privateKeyPem, "/portfolio/balance"),
    fetchKalshiAuthenticated<KalshiPositionsResponse>(
      apiBase,
      apiKeyId,
      privateKeyPem,
      "/portfolio/positions?limit=1000"
    ),
    fetchAllPages<KalshiFillsResponse, KalshiFill>(
      apiBase,
      apiKeyId,
      privateKeyPem,
      "/portfolio/fills",
      (d) => d.fills ?? [],
      (d) => d.cursor
    ),
    fetchAllPages<KalshiSettlementsResponse, KalshiSettlement>(
      apiBase,
      apiKeyId,
      privateKeyPem,
      "/portfolio/settlements",
      (d) => d.settlements ?? [],
      (d) => d.cursor
    ),
  ]);

  return {
    balance: balance ?? null,
    marketPositions: positionsData?.market_positions ?? [],
    eventPositions: positionsData?.event_positions ?? [],
    fills,
    settlements,
  };
}
