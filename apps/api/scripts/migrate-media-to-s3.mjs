// One-off (P1-03): move listing photos still held as base64 in Postgres into
// the media bucket, in batches. Safe to stop and run again: each row is
// uploaded first and only then has its bytes cleared.
//
//   DATABASE_URL=... MEDIA_BUCKET=nhonga-<env>-media AWS_REGION=af-south-1 \
//     node scripts/migrate-media-to-s3.mjs [--dry-run]
//
// Run from a task inside the VPC (the database is private), e.g. with
// `aws ecs execute-command` on an API task, after the deploy that added
// MEDIA_BUCKET. Afterwards, `VACUUM (FULL) media_asset;` returns the space.
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
const bucket = process.env.MEDIA_BUCKET;
const dry = process.argv.includes('--dry-run');
if (!url || !bucket) {
  console.error('DATABASE_URL and MEDIA_BUCKET are required');
  process.exit(1);
}
const sql = postgres(url, { max: 2, onnotice: () => {} });
const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'af-south-1' });
const ext = (t) => (t === 'image/png' ? 'png' : t === 'image/jpeg' ? 'jpg' : 'webp');

let moved = 0;
try {
  for (;;) {
    const rows = await sql`
      select id, content_type, data_base64 from media_asset
      where storage_key is null and data_base64 is not null
      order by created_at limit 50`;
    if (rows.length === 0) break;
    for (const r of rows) {
      const key = `media/${r.id}.${ext(r.content_type)}`;
      if (!dry) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: Buffer.from(r.data_base64, 'base64'),
            ContentType: r.content_type,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        await sql`update media_asset set storage_key = ${key}, data_base64 = null where id = ${r.id}`;
      }
      moved++;
    }
    if (dry) break;
    console.log(`moved ${moved}`);
  }
  console.log(`done: ${moved} photo(s) ${dry ? 'would move' : 'moved'}`);
} finally {
  await sql.end();
}
