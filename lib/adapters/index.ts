/**
 * Adapter registry: resolves adapter by Site.adapterKey.
 */
import type { Adapter } from "./types";
import { kalshiAdapter } from "./kalshi";

const ADAPTERS: Record<string, Adapter> = {
  kalshi: kalshiAdapter,
};

export type { Adapter, EventMarketInput, MarketInput, SectionInput, SiteInput } from "./types";
export { kalshiAdapter } from "./kalshi";

/** Get adapter by key; returns undefined if not found. */
export function getAdapter(adapterKey: string): Adapter | undefined {
  return ADAPTERS[adapterKey];
}
