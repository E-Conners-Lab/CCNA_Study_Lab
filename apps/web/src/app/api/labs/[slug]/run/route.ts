import { NextRequest } from "next/server";
import { execFile } from "child_process";
import { writeFile } from "fs/promises";
import { unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { getLabForRun, saveLabAttempt } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { jsonOk, jsonNotFound, jsonBadRequest, jsonError } from "@/lib/api-helpers";
import { createRateLimiter } from "@/lib/rate-limit";

// 30 lab runs per minute per IP
const labRunLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

// ---------------------------------------------------------------------------
// Lab types that can be executed as Python scripts
// ---------------------------------------------------------------------------

const PYTHON_LAB_TYPES = new Set(["python"]);
const TEXT_LAB_TYPES = new Set(["ios-cli", "subnetting", "config-review", "acl-builder"]);

// Dangerous Python modules that should not be importable in student code
const BLOCKED_IMPORTS = [
  "subprocess", "os", "sys", "shutil", "pathlib",
  "socket", "http", "urllib", "requests", "ftplib", "smtplib",
  "ctypes", "multiprocessing", "signal", "resource",
  "importlib", "code", "compile", "compileall",
  "webbrowser", "antigravity", "turtle",
  "pickle", "shelve", "marshal",
  "__builtin__", "builtins",
];

function containsBlockedImport(code: string): string | null {
  for (const mod of BLOCKED_IMPORTS) {
    // Match: import os, from os import ..., __import__('os')
    const patterns = [
      new RegExp(`^\\s*import\\s+${mod}\\b`, "m"),
      new RegExp(`^\\s*from\\s+${mod}\\b`, "m"),
      new RegExp(`__import__\\s*\\(\\s*['"]${mod}['"]`, "m"),
    ];
    for (const pat of patterns) {
      if (pat.test(code)) return mod;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Run Python code locally via subprocess
// ---------------------------------------------------------------------------

async function runPythonLocally(
  code: string,
): Promise<{ success: boolean; output: string; executionTime: number }> {
  const tmpFile = path.join(tmpdir(), `studylab-${randomUUID()}.py`);
  const start = Date.now();

  try {
    await writeFile(tmpFile, code, "utf-8");

    const result = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        execFile(
          "python3",
          ["-u", "-S", tmpFile],
          {
            timeout: 30_000,
            maxBuffer: 1024 * 512,
            env: {
              PATH: process.env.PATH ?? "",
              LANG: "en_US.UTF-8",
              PYTHONDONTWRITEBYTECODE: "1",
            } as unknown as NodeJS.ProcessEnv,
          },
          (error, stdout, stderr) => {
            if (error && !stdout && !stderr) {
              reject(error);
            } else {
              resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
            }
          },
        );
      },
    );

    const elapsed = Date.now() - start;
    const output = (result.stdout + result.stderr).trim();

    return {
      success: !result.stderr,
      output: output || "(no output)",
      executionTime: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    const message =
      err instanceof Error ? err.message : "Unknown execution error";
    // Extract useful Python traceback from the error
    const match = message.match(/\n(Traceback[\s\S]*)/);
    return {
      success: false,
      output: match ? match[1].trim() : message,
      executionTime: elapsed,
    };
  } finally {
    try { unlinkSync(tmpFile); } catch { /* already cleaned up */ }
  }
}

// ---------------------------------------------------------------------------
// POST /api/labs/[slug]/run
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = labRunLimiter.check(request);
  if (limited) return limited;

  try {
    const { slug } = await params;
    const lab = getLabForRun(slug);

    if (!lab) {
      return jsonNotFound(`Lab "${slug}"`);
    }

    // Parse and validate request body
    let body: { code: string; iosValidation?: { score: number; status: string } };
    try {
      body = await request.json();
    } catch {
      return jsonBadRequest("Invalid JSON in request body");
    }

    const { code, iosValidation } = body;

    if (!code || typeof code !== "string") {
      return jsonBadRequest('"code" string is required');
    }

    // IOS CLI labs validated client-side — just record the attempt
    if (iosValidation && lab.type === "ios-cli") {
      const userId = await getCurrentUserId();
      if (userId) {
        const status = iosValidation.score === 100 ? "completed" : "started";
        saveLabAttempt(userId, slug, status, code).catch((err) =>
          console.warn("Background lab attempt save failed:", err),
        );
      }
      return jsonOk({
        success: iosValidation.score === 100,
        output: `IOS CLI validation: ${iosValidation.score}%`,
        executionTime: 0,
        engineAvailable: false,
      });
    }

    // Try to proxy to the Docker lab engine (only if explicitly configured)
    const LAB_ENGINE_URL = process.env.LAB_ENGINE_URL;

    if (LAB_ENGINE_URL) {
      try {
        const engineResponse = await fetch(LAB_ENGINE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            language: lab.type,
            slug,
          }),
          signal: AbortSignal.timeout(30000),
        });

        const engineData = await engineResponse.json();

        // Fire-and-forget: save lab attempt to DB
        const userId = await getCurrentUserId();
        if (userId) {
          const status = engineResponse.ok ? "completed" : "failed";
          saveLabAttempt(userId, slug, status, code).catch((err) =>
            console.warn("Background lab attempt save failed:", err),
          );
        }

        return jsonOk({
          success: engineResponse.ok,
          output: engineData.output ?? engineData.error ?? "No output",
          executionTime: engineData.executionTime ?? 0,
          engineAvailable: true,
        });
      } catch {
        // Engine configured but unavailable — fall through to local execution
      }
    }

    // Python-based labs: execute locally via python3 subprocess
    if (PYTHON_LAB_TYPES.has(lab.type)) {
      const blocked = containsBlockedImport(code);
      if (blocked) {
        return jsonOk({
          success: false,
          output: `Security: import of "${blocked}" is not allowed in lab submissions. This module could be used to access the host system.`,
          executionTime: 0,
          engineAvailable: false,
        });
      }

      const result = await runPythonLocally(code);

      // Fire-and-forget: save lab attempt to DB
      const userId = await getCurrentUserId();
      if (userId) {
        const status = result.success ? "completed" : "failed";
        saveLabAttempt(userId, slug, status, code).catch((err) =>
          console.warn("Background lab attempt save failed:", err),
        );
      }

      return jsonOk({
        success: result.success,
        output: result.output,
        executionTime: result.executionTime,
        engineAvailable: false,
      });
    }

    // Text-based labs (IOS CLI, subnetting, config review, ACL): validate locally
    if (TEXT_LAB_TYPES.has(lab.type)) {
      const userId = await getCurrentUserId();
      if (userId) {
        saveLabAttempt(userId, slug, "started", code).catch((err) =>
          console.warn("Background lab attempt save failed:", err),
        );
      }

      return jsonOk({
        success: true,
        output:
          "Text-based lab submitted. For full grading, start the Docker lab engine.",
        executionTime: 0,
        engineAvailable: false,
      });
    }

    // Unsupported lab type
    return jsonOk({
      success: true,
      output:
        "This lab type requires the Docker lab engine. Set LAB_ENGINE_URL and start Docker services.",
      executionTime: 0,
      engineAvailable: false,
    });
  } catch (error) {
    console.error("Error running lab code:", error);
    return jsonError("Failed to run code");
  }
}
