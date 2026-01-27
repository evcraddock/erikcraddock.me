import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { logger } from "@/utils/logger";

const s3Config = {
  endpoint: process.env.S3_ENDPOINT || "http://localhost:3900",
  region: process.env.S3_REGION || "garage",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true, // Required for Garage/MinIO
};

const bucket = process.env.S3_BUCKET || "erikcraddock-media";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    logger.debug("s3", "Initializing S3 client", {
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      bucket,
    });
    client = new S3Client(s3Config);
  }
  return client;
}

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Upload a file to S3
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<UploadResult> {
  const s3 = getClient();

  logger.debug("s3", "Uploading file", { key, contentType, size: body.length });

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );

    const url = `${s3Config.endpoint}/${bucket}/${key}`;
    logger.info("s3", "File uploaded", { key, url });

    return { key, url };
  } catch (error) {
    logger.error("s3", "Upload failed", { key, error: String(error) });
    throw error;
  }
}

/**
 * Get a file from S3
 */
export async function getFile(key: string): Promise<Buffer> {
  const s3 = getClient();

  logger.debug("s3", "Getting file", { key });

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    const body = await response.Body?.transformToByteArray();
    if (!body) {
      throw new Error("Empty response body");
    }

    logger.debug("s3", "File retrieved", { key, size: body.length });
    return Buffer.from(body);
  } catch (error) {
    logger.error("s3", "Get failed", { key, error: String(error) });
    throw error;
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  const s3 = getClient();

  logger.debug("s3", "Deleting file", { key });

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    logger.info("s3", "File deleted", { key });
  } catch (error) {
    logger.error("s3", "Delete failed", { key, error: String(error) });
    throw error;
  }
}

/**
 * Generate a unique key for a file
 */
export function generateKey(filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.split(".").pop() || "";
  return `${timestamp}-${random}.${ext}`;
}

export { bucket as s3Bucket };
