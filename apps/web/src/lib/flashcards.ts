import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Flashcard {
  id: string;
  domain: number;
  domainName: string;
  domainSlug: string;
  objectiveCode: string;
  question: string;
  answer: string;
  explanation: string;
  sourceUrl: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export interface FlashcardProgress {
  flashcardId: string;
  repetitions: number;
  ease: number;
  interval: number;
  nextReview: string; // ISO date string
  lastReview: string; // ISO date string
  quality: number; // last quality rating
}

// Re-export SM-2 from shared module
export { sm2 } from "@/lib/sm2";
export type { SM2Result } from "@/lib/sm2";

import { NUMBER_TO_SLUG } from "@/lib/domains";

// ---------------------------------------------------------------------------
// File loading utilities (server-side only)
// ---------------------------------------------------------------------------

interface RawFlashcardFile {
  domain: number;
  domainName: string;
  flashcards: {
    id: string;
    objectiveCode: string;
    question: string;
    answer: string;
    explanation: string;
    sourceUrl: string;
    difficulty: "easy" | "medium" | "hard";
    tags: string[];
  }[];
}

function getFlashcardsDir(): string {
  // content/flashcards/ is at the monorepo root
  // apps/web/ is two levels deep from root
  return path.join(process.cwd(), "..", "..", "content", "flashcards");
}

function loadFlashcardFile(filePath: string): Flashcard[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: RawFlashcardFile = JSON.parse(raw);
  const slug = NUMBER_TO_SLUG[data.domain] ?? `domain-${data.domain}`;

  return data.flashcards.map((fc) => ({
    id: fc.id,
    domain: data.domain,
    domainName: data.domainName,
    domainSlug: slug,
    objectiveCode: fc.objectiveCode,
    question: fc.question,
    answer: fc.answer,
    explanation: fc.explanation,
    sourceUrl: fc.sourceUrl,
    difficulty: fc.difficulty,
    tags: fc.tags,
  }));
}

// Module-level cache (safe — flashcard JSON is static at runtime)
let flashcardCache: Flashcard[] | null = null;

/**
 * Returns all flashcards from every domain file.
 */
export function getAllFlashcards(): Flashcard[] {
  if (flashcardCache) return flashcardCache;

  const dir = getFlashcardsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("domain-") && f.endsWith(".json"))
    .sort();

  const all: Flashcard[] = [];
  for (const file of files) {
    all.push(...loadFlashcardFile(path.join(dir, file)));
  }
  flashcardCache = all;
  return all;
}

/**
 * Returns flashcards filtered by domain slug.
 */
export function getFlashcardsByDomain(domainSlug: string): Flashcard[] {
  const all = getAllFlashcards();
  return all.filter((fc) => fc.domainSlug === domainSlug);
}
