import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET ?? "civic-media";

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true, // required for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minio",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minio12345",
  },
});

let ensured = false;

/** Create the bucket on first use. Objects are served via the app's /media
 *  proxy (getObject), so MinIO itself stays private — no public-read policy. */
async function ensureBucket(): Promise<void> {
  if (ensured) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  ensured = true;
}

/**
 * Upload bytes and return an ORIGIN-RELATIVE URL (`/media/<key>`) served by the
 * app's media proxy. Relative on purpose: the same stored URL then works over
 * localhost, a LAN IP, or a Cloudflare tunnel with zero reconfiguration, and
 * MinIO never has to be exposed to other devices.
 */
export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  await ensureBucket();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
  return `/media/${key}`;
}

/** Stream an object back for the /media proxy route. Returns null if missing. */
export async function getObject(
  key: string,
): Promise<{ stream: ReadableStream; contentType: string } | null> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) return null;
    return {
      stream: res.Body.transformToWebStream(),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}
