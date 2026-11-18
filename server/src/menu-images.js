import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const maxBytes = 2 * 1024 * 1024;
const formats = new Set(['jpeg', 'png', 'webp']);

export async function decodeMenuPhoto(encoded) {
  if (encoded === undefined || encoded === null) return encoded;
  if (typeof encoded !== 'string' || !encoded.length || encoded.length > Math.ceil(maxBytes / 3) * 4
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('Choose a JPEG, PNG, or WebP photo up to 2 MiB.');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > maxBytes) throw new Error('The photo exceeds 2 MiB.');
  try {
    const image = sharp(bytes, { limitInputPixels: 25000000, failOn: 'warning' });
    if (!formats.has((await image.metadata()).format)) throw new Error('Unsupported format');
    return await image.rotate().resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
  } catch {
    throw new Error('Choose a readable JPEG, PNG, or WebP photo of 25 megapixels or less.');
  }
}

export async function saveMenuPhoto(tx, id, photo) {
  if (photo === undefined) return;
  if (photo === null) {
    await tx.run('DELETE FROM menu_images WHERE menu_item_id = ?', id);
    return;
  }
  await tx.run(`
    INSERT INTO menu_images (menu_item_id, version, photo) VALUES (?, ?, ?)
    ON CONFLICT (menu_item_id) DO UPDATE SET version = excluded.version, photo = excluded.photo
  `, id, randomUUID(), photo);
}
