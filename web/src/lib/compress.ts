import sharp from 'sharp';

// Image models hand back multi-megabyte PNGs. Pictures are stored as JPEG at book-page size:
// about a tenth of the bytes, still sharp on a tablet, and readable by every e-reader (older
// Kobos don't take WebP). Character sheets keep a little more quality, since later pictures
// are drawn from them.

export async function forReading(bytes: Uint8Array, kind: 'picture' | 'sheet' = 'picture') {
  try {
    const out = await sharp(bytes)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: kind === 'sheet' ? 90 : 82, mozjpeg: true })
      .toBuffer();
    return { bytes: new Uint8Array(out), mediaType: 'image/jpeg' };
  } catch {
    // If anything about the image is unusual, keep the original rather than lose the picture.
    return null;
  }
}
