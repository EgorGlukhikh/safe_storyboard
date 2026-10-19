'use strict';

const fs = require('node:fs');
const path = require('node:path');

function validateRaster(bytes) {
  const buffer = Buffer.from(bytes || []);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return { format: 'png', extension: '.png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { format: 'jpeg', extension: '.jpg' };
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return { format: 'gif', extension: '.gif' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { format: 'webp', extension: '.webp' };
  return null;
}

function mergeAvatarManifest(existing = {}, discovered = []) {
  const result = structuredClone(existing);
  for (const item of discovered) {
    const key = String(item.character || '').trim().toLowerCase();
    if (!key || item.error || !item.localPath || !item.format) continue;
    if (Array.isArray(item.candidates) && item.candidates.length !== 1) continue;
    result[key] = {
      character: item.character,
      sourceUrl: item.sourceUrl,
      localPath: item.localPath,
      format: item.format,
      verifiedAt: item.verifiedAt,
    };
  }
  return result;
}

function attachAvatars(characters, manifest = {}) {
  return characters.map((character) => ({
    ...character,
    avatar: manifest[character.name.toLowerCase()]?.localPath || null,
  }));
}

function slugifyCharacter(name) {
  return String(name || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9а-яё]+/giu, '-').replace(/^-|-$/g, '') || 'character';
}

function validateAvatarManifest(docsDir, manifest = {}) {
  const invalid = [];
  for (const entry of Object.values(manifest)) {
    const filePath = path.resolve(docsDir, entry.localPath || '');
    const safeRoot = `${path.resolve(docsDir)}${path.sep}`;
    if (!filePath.startsWith(safeRoot) || !fs.existsSync(filePath)) {
      invalid.push(entry.character);
      continue;
    }
    const detected = validateRaster(fs.readFileSync(filePath));
    if (!detected || detected.format !== entry.format) invalid.push(entry.character);
  }
  return invalid;
}

module.exports = { validateRaster, mergeAvatarManifest, attachAvatars, slugifyCharacter, validateAvatarManifest };
