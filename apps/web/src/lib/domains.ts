// ---------------------------------------------------------------------------
// Canonical Domain Data — CCNA 200-301 Exam
// ---------------------------------------------------------------------------
//
// Single source of truth for the six exam domains. Every other module
// derives its domain lists from this array. When Cisco updates the exam
// blueprint, edit ONLY this file.
// ---------------------------------------------------------------------------

export interface CCNADomain {
  /** 1-based domain number matching the exam blueprint */
  number: number;
  /** URL-safe slug used in routes and API calls */
  slug: string;
  /** Full official domain name */
  name: string;
  /** Shortened name for tight UI spaces (tabs, badges) */
  shortName: string;
  /** Exam weight percentage */
  weight: number;
}

export const CCNA_DOMAINS: readonly CCNADomain[] = [
  { number: 1, slug: "network-fundamentals",      name: "Network Fundamentals",            shortName: "Fundamentals",  weight: 20 },
  { number: 2, slug: "network-access",             name: "Network Access",                  shortName: "Access",        weight: 20 },
  { number: 3, slug: "ip-connectivity",            name: "IP Connectivity",                 shortName: "Connectivity",  weight: 25 },
  { number: 4, slug: "ip-services",                name: "IP Services",                     shortName: "Services",      weight: 10 },
  { number: 5, slug: "security-fundamentals",      name: "Security Fundamentals",           shortName: "Security",      weight: 15 },
  { number: 6, slug: "automation-programmability",  name: "Automation and Programmability",   shortName: "Automation",    weight: 10 },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getDomainBySlug(slug: string | null): CCNADomain | undefined {
  if (!slug) return undefined;
  return CCNA_DOMAINS.find((d) => d.slug === slug);
}

export function getDomainByNumber(num: number | null): CCNADomain | undefined {
  if (num == null) return undefined;
  return CCNA_DOMAINS.find((d) => d.number === num);
}

export function domainSlugToNumber(slug: string | null): number | null {
  return getDomainBySlug(slug)?.number ?? null;
}

export function domainNumberToSlug(num: number | null): string | null {
  return getDomainByNumber(num)?.slug ?? null;
}

// ---------------------------------------------------------------------------
// Derived formats for common UI patterns
// ---------------------------------------------------------------------------

/** For Select/dropdown components: { value, label } */
export function getDomainSelectOptions(includeAll = true) {
  const options = CCNA_DOMAINS.map((d) => ({
    value: d.slug,
    label: `${d.number}. ${d.name}`,
  }));
  return includeAll
    ? [{ value: "all", label: "All Domains" }, ...options]
    : options;
}

/** For Tab components: { slug, label, short } */
export function getDomainTabItems(includeAll = true) {
  const tabs = CCNA_DOMAINS.map((d) => ({
    slug: d.slug,
    label: `${d.number}. ${d.shortName}`,
    short: `D${d.number}`,
  }));
  return includeAll
    ? [{ slug: "all", label: "All Domains", short: "All" }, ...tabs]
    : tabs;
}

// ---------------------------------------------------------------------------
// Mappings used by server-side data loaders
// ---------------------------------------------------------------------------

/** Slug -> study-guide JSON filename */
export const SLUG_TO_STUDY_FILE: Record<string, string> = Object.fromEntries(
  CCNA_DOMAINS.map((d) => [d.slug, `domain-${d.number}-${d.slug}.json`]),
);

/** Domain number -> slug (used by flashcard file loader) */
export const NUMBER_TO_SLUG: Record<number, string> = Object.fromEntries(
  CCNA_DOMAINS.map((d) => [d.number, d.slug]),
);
