// ---------------------------------------------------------------------------
// IOS command validator — compares student commands against solutionCode
// ---------------------------------------------------------------------------

import type { ValidationResult, DeviceSection } from "./ios-types";
import { normalizeInterface, expandCommand } from "./ios-simulator";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate student commands against the solution.
 * Returns score, matched/missing/extra commands, and feedback.
 */
export function validateCommands(
  studentCommands: string[],
  solutionCode: string,
): ValidationResult {
  const solutionSections = parseSections(solutionCode);
  const studentSections = parseSections(studentCommands.join("\n"));

  // If the solution has multiple devices, match sections by device name
  if (solutionSections.length > 1) {
    return validateMultiDevice(studentSections, solutionSections);
  }

  // Single-device: compare flat command lists
  const solCmds = solutionSections.flatMap((s) => s.commands);
  const stuCmds = studentSections.flatMap((s) => s.commands);
  return compareCommands(stuCmds, solCmds);
}

/**
 * Parse device sections from solution/student code.
 * Splits at `! ========== DEVICE_NAME ==========` markers.
 */
export function parseSections(code: string): DeviceSection[] {
  const lines = code.split("\n");
  const sections: DeviceSection[] = [];
  let currentSection: DeviceSection | null = null;

  for (const raw of lines) {
    const line = raw.trim();

    // Check for device marker
    const markerMatch = line.match(/^!\s*=+\s*(.+?)\s*=+\s*$/);
    if (markerMatch) {
      if (currentSection) sections.push(currentSection);
      const label = markerMatch[1].trim();
      const hostnameMatch =
        label.match(/\((\w+)\)/) ?? label.match(/(\w+)$/);
      const hostname = hostnameMatch ? hostnameMatch[1] : label;
      currentSection = { deviceName: label, hostname, commands: [] };
      continue;
    }

    if (!currentSection) {
      currentSection = {
        deviceName: "default",
        hostname: "Router",
        commands: [],
      };
    }

    const normalized = normalizeLine(line);
    if (normalized) {
      currentSection.commands.push(normalized);
    }
  }

  if (
    currentSection &&
    (currentSection.commands.length > 0 ||
      currentSection.deviceName !== "default")
  ) {
    sections.push(currentSection);
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Commands to skip during grading (mode transitions / verification) */
const SKIP_COMMANDS = new Set([
  "enable",
  "en",
  "configure terminal",
  "conf t",
  "config t",
  "configure t",
  "config terminal",
  "conf terminal",
  "end",
  "exit",
  "ex",
]);

/** Normalize a single config line for comparison */
function normalizeLine(line: string): string | null {
  let l = line.trim();
  // Skip comments and blank lines
  if (!l || l.startsWith("!")) return null;

  const lower = l.toLowerCase();

  // Skip mode-transition and verification commands
  if (SKIP_COMMANDS.has(lower)) return null;
  if (lower.startsWith("show ") || lower.startsWith("sh ")) return null;
  if (lower.startsWith("debug ")) return null;
  if (lower.startsWith("do ")) return null;

  // Expand IOS abbreviations to full keywords
  l = expandCommand(l);

  // Normalize interface names (handles Gi → GigabitEthernet etc.)
  l = l.replace(
    /\b(Gi|Gig|Fa|Et|Se|Lo|Po|Vl)(\d)/gi,
    (_, prefix, num) => normalizeInterface(prefix + num),
  );

  // Collapse multiple spaces
  l = l.replace(/\s+/g, " ");

  return l.toLowerCase();
}

/** Compare two flat command arrays */
function compareCommands(
  student: string[],
  solution: string[],
): ValidationResult {
  const solSet = new Set(solution);
  const stuSet = new Set(student);

  const matched: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];

  for (const cmd of solution) {
    if (stuSet.has(cmd)) {
      matched.push(cmd);
    } else {
      missing.push(cmd);
    }
  }

  for (const cmd of student) {
    if (!solSet.has(cmd)) {
      extra.push(cmd);
    }
  }

  const total = solution.length;
  const score =
    total === 0 ? 100 : Math.round((matched.length / total) * 100);

  let feedback: string;
  if (score === 100) {
    feedback = "All required commands are present. Excellent work!";
  } else if (score >= 80) {
    feedback = `Almost there! You're missing ${missing.length} command${missing.length === 1 ? "" : "s"}.`;
  } else if (score >= 50) {
    feedback = `Good progress. ${missing.length} command${missing.length === 1 ? "" : "s"} still needed.`;
  } else {
    feedback = `Keep going! Review the instructions for the ${missing.length} missing command${missing.length === 1 ? "" : "s"}.`;
  }

  return { score, matched, missing, extra, feedback };
}

/** Validate multi-device labs section by section */
function validateMultiDevice(
  studentSections: DeviceSection[],
  solutionSections: DeviceSection[],
): ValidationResult {
  const allMatched: string[] = [];
  const allMissing: string[] = [];
  const allExtra: string[] = [];
  let totalSol = 0;

  for (const solSection of solutionSections) {
    const stuSection = studentSections.find(
      (s) =>
        s.hostname.toLowerCase() === solSection.hostname.toLowerCase() ||
        s.deviceName.toLowerCase() === solSection.deviceName.toLowerCase(),
    );

    const stuCmds = stuSection?.commands ?? [];
    const result = compareCommands(stuCmds, solSection.commands);

    const tag = solSection.hostname;
    allMatched.push(...result.matched.map((c) => `[${tag}] ${c}`));
    allMissing.push(...result.missing.map((c) => `[${tag}] ${c}`));
    allExtra.push(...result.extra.map((c) => `[${tag}] ${c}`));
    totalSol += solSection.commands.length;
  }

  const score =
    totalSol === 0
      ? 100
      : Math.round((allMatched.length / totalSol) * 100);

  let feedback: string;
  if (score === 100) {
    feedback = "All devices configured correctly. Excellent work!";
  } else if (score >= 80) {
    feedback = `Almost there! Missing ${allMissing.length} command${allMissing.length === 1 ? "" : "s"} across devices.`;
  } else if (score >= 50) {
    feedback = `Good progress. ${allMissing.length} command${allMissing.length === 1 ? "" : "s"} still needed across devices.`;
  } else {
    feedback = `Keep going! Review the instructions for each device.`;
  }

  return {
    score,
    matched: allMatched,
    missing: allMissing,
    extra: allExtra,
    feedback,
  };
}
