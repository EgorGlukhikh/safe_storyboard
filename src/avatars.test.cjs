'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadAvatars() {
  return require('./avatars.cjs');
}

test('accepts supported raster signatures and chooses safe extensions', () => {
  const { validateRaster } = loadAvatars();
  const cases = [
    [Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), { format: 'png', extension: '.png' }],
    [Buffer.from('ffd8ffe000104a464946', 'hex'), { format: 'jpeg', extension: '.jpg' }],
    [Buffer.from('474946383961', 'hex'), { format: 'gif', extension: '.gif' }],
    [Buffer.from('524946460000000057454250', 'hex'), { format: 'webp', extension: '.webp' }],
  ];

  for (const [bytes, expected] of cases) assert.deepEqual(validateRaster(bytes), expected);
});

test('rejects svg html and unknown bytes', () => {
  const { validateRaster } = loadAvatars();
  assert.equal(validateRaster(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(validateRaster(Buffer.from('<!doctype html><title>login</title>')), null);
  assert.equal(validateRaster(Buffer.from('not an image')), null);
});

test('keeps an existing verified avatar when refresh fails', () => {
  const { mergeAvatarManifest } = loadAvatars();
  const existing = {
    'arthur weasley': { character: 'Arthur Weasley', sourceUrl: 'https://old.test/a.png', localPath: 'assets/avatars/arthur-weasley.png', format: 'png', verifiedAt: '2026-10-18T00:00:00.000Z' },
  };
  const merged = mergeAvatarManifest(existing, [{ character: 'Arthur Weasley', error: 'temporary failure' }]);

  assert.deepEqual(merged, existing);
});

test('does not guess an ambiguous mask avatar', () => {
  const { mergeAvatarManifest } = loadAvatars();
  const merged = mergeAvatarManifest({}, [{ character: 'Gilroy Reid', candidates: ['https://a.test/1.png', 'https://a.test/2.png'] }]);

  assert.equal(merged['gilroy reid'], undefined);
});

test('emits null for a character without a manifest entry', () => {
  const { attachAvatars } = loadAvatars();
  const characters = attachAvatars([{ name: 'Molly Weasley', owner: null, aliases: [], avatar: null }], {});

  assert.equal(characters[0].avatar, null);
});

test('verifies every cached manifest path as a supported raster', () => {
  const { validateAvatarManifest } = loadAvatars();
  const manifest = require('./avatar-manifest.json');
  const invalid = validateAvatarManifest(path.join(__dirname, '..', 'docs'), manifest);

  assert.deepEqual(invalid, []);
});
