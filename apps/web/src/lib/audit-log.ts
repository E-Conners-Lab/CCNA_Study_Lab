/**
 * Audit logger for security-relevant events.
 *
 * Logs to stdout in structured JSON format for easy ingestion by
 * log aggregation services. Events include login, signup, password
 * changes, and failed authentication attempts.
 */

type AuditEvent =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "SIGNUP"
  | "PASSWORD_RESET"
  | "EMAIL_VERIFIED"
  | "RATE_LIMITED";

interface AuditEntry {
  event: AuditEvent;
  email?: string;
  ip?: string;
  detail?: string;
}

export function auditLog(entry: AuditEntry): void {
  const record = {
    type: "AUDIT",
    timestamp: new Date().toISOString(),
    event: entry.event,
    ...(entry.email && { email: entry.email }),
    ...(entry.ip && { ip: entry.ip }),
    ...(entry.detail && { detail: entry.detail }),
  };

  // Structured JSON log — separate from application logs
  console.log(JSON.stringify(record));
}

/**
 * Extract client IP from a Request for audit logging.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
