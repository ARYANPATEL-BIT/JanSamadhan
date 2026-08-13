import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET ?? "civic-media";
const publicBase = process.env.S3_PUBLIC_URL ?? `http://localhost:9000/${bucket}`;

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

/** Create the bucket on first use and make objects publicly readable (dev). */
async function ensureBucket(): Promise<void> {
  if (ensured) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
  }
  ensured = true;
}

/** Upload bytes and return the public URL the browser can load. */
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
  return `${publicBase}/${key}`;
}
