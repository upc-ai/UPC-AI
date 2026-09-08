/**
 * Raw-file storage for ingestion: Supabase Storage when configured, local
 * disk otherwise (dev). The web upload route stores via the same adapter so
 * the browser-direct signed upload and the pipeline read the same object.
 *
 * Supabase Storage REST (service_role):
 *   POST   /storage/v1/object/upload/sign/{bucket}/{path}   → signed upload URL
 *   HEAD   /storage/v1/object/authenticated/{bucket}/{path}  → existence check
 *   GET    /storage/v1/object/authenticated/{bucket}/{path}  → download
 * Signed URL semantics: browser PUTs the raw bytes with Content-Type — no
 * Authorization header (the token is in the query string).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageConfig {
  supabaseUrl: string;
  serviceKey: string;
  bucket: string;
}

export const STORAGE_BUCKET = "upc-docs";

export function resolveStorageConfig(env: {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}): StorageConfig | null {
  if (env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return {
      supabaseUrl: env.SUPABASE_URL.trim().replace(/\/$/, ""),
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY.trim(),
      bucket: STORAGE_BUCKET,
    };
  }
  return null;
}

/** Object path inside the bucket for a document's raw file. */
export function objectPathFor(documentId: string, extension: string): string {
  return `raw/${documentId}.${extension}`;
}

/** Local-disk path mirror (dev without Supabase) — matches the legacy upload route layout. */
export function localPathFor(storagePath: string): string {
  return storagePath.startsWith(STORAGE_BUCKET) ? path.join(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"), storagePath) : storagePath;
}

/** Create a signed upload URL (server-side; returned to the browser for a direct PUT). */
export async function createSignedUploadUrl(
  config: StorageConfig,
  objectPath: string,
): Promise<{ url: string; token: string }> {
  const res = await fetch(`${config.supabaseUrl}/storage/v1/object/upload/sign/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!res.ok) throw new Error(`Supabase sign failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { url: string; token: string };
  return { url: `${config.supabaseUrl}${json.url}`, token: json.token };
}

/** Server-side object put (web-sync route; the signed-URL path is browser-only). */
export async function uploadRaw(
  config: StorageConfig,
  objectPath: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`);
}

/** Does the object exist? (upload-complete verification via HEAD). */
export async function objectExists(config: StorageConfig, objectPath: string): Promise<boolean> {
  const res = await fetch(`${config.supabaseUrl}/storage/v1/object/authenticated/${config.bucket}/${objectPath}`, {
    method: "HEAD",
    headers: { Authorization: `Bearer ${config.serviceKey}` },
  });
  return res.ok;
}

/** Read the raw file for ingestion — Supabase object or local disk. */
export async function readRawFile(storagePath: string, config: StorageConfig | null): Promise<Buffer> {
  if (config && storagePath.startsWith(`${config.bucket}/`)) {
    const objectPath = storagePath.slice(config.bucket.length + 1);
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/authenticated/${config.bucket}/${objectPath}`, {
      headers: { Authorization: `Bearer ${config.serviceKey}` },
    });
    if (!res.ok) {
      // Supabase puts the real reason in the body (e.g. "The related resource
      // does not exist" = bucket/object missing) — surface it.
      const body = await res.text().catch(() => "");
      throw new Error(`Supabase download failed: ${res.status} ${body.slice(0, 300)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  const { readFile } = await import("node:fs/promises");
  return readFile(localPathFor(storagePath));
}

/** Server-side put (local-disk mode only; Supabase mode uploads via signed URL). */
export async function writeRawLocal(storagePath: string, bytes: Buffer): Promise<void> {
  const abs = localPathFor(storagePath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
}

export function sha256Hex(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
