import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { config } from "./config.ts";
const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY,
  },
});
export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode !== 404
    )
      throw error;
    await s3.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET }));
  }
}
export async function putObject(key: string, data: Buffer, type: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      Body: data,
      ContentType: type,
    }),
  );
}
export async function getObject(key: string) {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
  if (!result.Body) throw new Error("Object missing");
  return Buffer.from(await result.Body.transformToByteArray());
}
export async function deleteObject(key: string) {
  await s3.send(
    new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
}
