import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/** Where listing photos live (P1-03). */
export interface ObjectStore {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

/**
 * Private S3 bucket. The ECS task role may only Put/Get under media/ in this
 * bucket (infra/terraform/modules/media). Objects are immutable: an id is
 * never reused, so they are cached for a year.
 */
export class S3ObjectStore implements ObjectStore {
  private readonly s3: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    client?: S3Client,
  ) {
    this.s3 = client ?? new S3Client({ region });
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = out.Body;
      if (!body) return null;
      return Buffer.from(await body.transformToByteArray());
    } catch (e) {
      if ((e as { name?: string }).name === 'NoSuchKey') return null;
      throw e;
    }
  }
}

/** S3 when MEDIA_BUCKET is set, otherwise none (bytes stay in Postgres). */
export function objectStoreFromEnv(env = process.env): ObjectStore | null {
  const bucket = env['MEDIA_BUCKET'];
  if (!bucket) return null;
  return new S3ObjectStore(bucket, env['AWS_REGION'] ?? env['AWS_DEFAULT_REGION'] ?? 'af-south-1');
}
