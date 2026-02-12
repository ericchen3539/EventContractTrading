/**
 * localStorage persistence for events market page.
 * Keys: selectedSiteIds, sectionIdsBySite, cachedEvents.
 * Callers must validate data against current sites/sections.
 */

export const STORAGE_KEYS = {
  selectedSiteIds: "events-market:selectedSiteIds",
  sectionIdsBySite: "events-market:sectionIdsBySite",
  cachedEvents: "events-market:cachedEvents",
} as const;

export function loadSelectedSiteIds(validSiteIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.selectedSiteIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id: unknown): id is string =>
        typeof id === "string" && validSiteIds.includes(id)
    );
  } catch {
    return [];
  }
}

export function saveSelectedSiteIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.selectedSiteIds, JSON.stringify(ids));
  } catch {
    // Ignore quota/serialization errors
  }
}

/**
 * Load section IDs per site. Only returns entries for validSiteIds.
 * Section IDs are not validated at load time; callers filter when using.
 */
export function loadSectionIdsBySite(
  validSiteIds: string[]
): Record<string, string[]> {
  const siteIdSet = new Set(validSiteIds);
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sectionIdsBySite);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const result: Record<string, string[]> = {};
    for (const [siteId, arr] of Object.entries(parsed)) {
      if (!siteIdSet.has(siteId)) continue;
      const filtered = Array.isArray(arr)
        ? (arr as unknown[]).filter(
            (id): id is string => typeof id === "string"
          )
        : [];
      if (filtered.length > 0) result[siteId] = filtered;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveSectionIdsBySite(
  sectionIdsBySite: Record<string, string[]>
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.sectionIdsBySite,
      JSON.stringify(sectionIdsBySite)
    );
  } catch {
    // Ignore
  }
}

export function loadCachedEvents<T>(validSiteIds: string[]): T[] {
  const siteIdSet = new Set(validSiteIds);
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cachedEvents);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (ev: unknown): ev is T =>
        ev != null &&
        typeof ev === "object" &&
        "siteId" in ev &&
        typeof (ev as { siteId: unknown }).siteId === "string" &&
        siteIdSet.has((ev as { siteId: string }).siteId)
    );
  } catch {
    return [];
  }
}

export function saveCachedEvents<T extends { siteId: string }>(events: T[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.cachedEvents, JSON.stringify(events));
  } catch {
    // Ignore
  }
}
