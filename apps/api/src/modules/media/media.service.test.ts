import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { sanitiseImage, sniffImageType } from './media.service.js';

async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: '#0a7' } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestCam', Model: 'X1' },
      IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '25/1 58/1 0/1' },
    })
    .toBuffer();
}

describe('sniffImageType', () => {
  it('recognises real JPEG, PNG and WebP bytes', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    expect(sniffImageType(await jpegWithGps())).toBe('image/jpeg');
    expect(sniffImageType(png)).toBe('image/png');
    expect(sniffImageType(webp)).toBe('image/webp');
  });

  it('rejects a file with a fake image extension or type', () => {
    expect(sniffImageType(Buffer.from('<?php echo "hi"; ?>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });
});

describe('sanitiseImage', () => {
  it('strips EXIF and GPS metadata', async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await sanitiseImage(input);
    expect(out.contentType).toBe('image/webp');
    const meta = await sharp(out.bytes).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it('refuses non-images even when labelled as one', async () => {
    await expect(sanitiseImage(Buffer.from('GIF89a not really'))).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });

  it('refuses gigantic images (decompression bombs)', async () => {
    const huge = await sharp({
      create: { width: 10_000, height: 5_000, channels: 3, background: '#000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await expect(sanitiseImage(huge)).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('scales large photos down', async () => {
    const big = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#333' },
    })
      .jpeg()
      .toBuffer();
    const meta = await sharp((await sanitiseImage(big)).bytes).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
  });
});
