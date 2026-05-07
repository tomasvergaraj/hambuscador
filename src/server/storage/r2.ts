import { AwsClient } from "aws4fetch";

// ============================================================================
// Cloudflare R2 — presigned PUT URLs.
// ----------------------------------------------------------------------------
// Patrón estándar: el cliente pide al server una URL firmada, después sube el
// archivo directo a R2 sin pasar por nuestro server. Esto evita tráfico de
// upload por nuestra app.
//
// `aws4fetch` (~5KB) en vez de @aws-sdk/client-s3 (~300KB) — Cloudflare lo
// recomienda para serverless/edge runtimes.
// ============================================================================

const PRESIGNED_URL_TTL_S = 5 * 60; // 5 minutos para hacer el PUT

export type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

export function isStorageConfigured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_URL
  );
}

function readConfig(): StorageConfig {
  if (!isStorageConfigured()) {
    throw new Error(
      "R2 no configurado. Setear R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL en .env.local",
    );
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
    publicUrl: process.env.R2_PUBLIC_URL!.replace(/\/$/, ""),
  };
}

let _client: AwsClient | null = null;
function getClient(cfg: StorageConfig): AwsClient {
  if (_client) return _client;
  _client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return _client;
}

/**
 * Genera una URL firmada para `PUT key` y devuelve también la URL pública
 * que el cliente debe guardar después de subir.
 *
 * El cliente debe hacer:
 *   fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": ct } })
 * y luego usar `publicUrl` como source de la imagen.
 */
export async function getUploadUrl(opts: {
  key: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const cfg = readConfig();
  const client = getClient(cfg);

  const endpoint = `https://${cfg.accountId}.r2.cloudflarestorage.com`;
  const url = new URL(`${endpoint}/${cfg.bucket}/${opts.key}`);
  url.searchParams.set("X-Amz-Expires", String(PRESIGNED_URL_TTL_S));

  const signedReq = await client.sign(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": opts.contentType },
    aws: { signQuery: true },
  });

  return {
    uploadUrl: signedReq.url,
    publicUrl: `${cfg.publicUrl}/${opts.key}`,
  };
}
