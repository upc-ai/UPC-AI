import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, type ApiWarning } from "@upc/core";

/** Standard JSON success with optional warnings channel (Backend §8). */
export function ok<T>(data: T, init?: { status?: number; warnings?: ApiWarning[] }) {
  return NextResponse.json(
    { data, ...(init?.warnings?.length ? { warnings: init.warnings } : {}) },
    { status: init?.status ?? 200 },
  );
}

/** Standard error envelope: stable code + request_id (Backend §8). */
export function fail(err: unknown) {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();

  if (err instanceof ApiError) {
    const status = STATUS_BY_CODE[err.code] ?? 400;
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          request_id: requestId,
          timestamp,
        },
      },
      { status },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: err.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
          request_id: requestId,
          timestamp,
        },
      },
      { status: 400 },
    );
  }

  console.error("[unhandled]", err);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
        request_id: requestId,
        timestamp,
      },
    },
    { status: 500 },
  );
}

import { ERROR_CODES } from "@upc/core";

const STATUS_BY_CODE: Record<string, number> = Object.fromEntries(
  Object.entries(ERROR_CODES).map(([code, status]) => [code, status]),
);
