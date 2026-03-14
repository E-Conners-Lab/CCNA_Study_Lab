import { NextResponse } from "next/server";

/**
 * Standard JSON success response.
 */
export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Standard JSON error response.
 */
export function jsonError(message: string, status = 500) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function jsonBadRequest(message: string) {
  return jsonError(message, 400);
}

export function jsonNotFound(resource = "Resource") {
  return jsonError(`${resource} not found`, 404);
}
