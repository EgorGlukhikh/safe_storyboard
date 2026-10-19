'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeEpisodes, countSourceBuckets, buildCharacterIndex } = require('../src/calendar.cjs');
const { attachAvatars, validateAvatarManifest } = require('../src/avatars.cjs');

function buildRelease(rootDir = path.resolve(__dirname, '..')) {
  const source = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'episode-source.json'), 'utf8'));
  const manifestPath = path.join(rootDir, 'src', 'avatar-manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const episodes = normalizeEpisodes(source);
  const invalidAvatars = validateAvatarManifest(path.join(rootDir, 'docs'), manifest);
  if (invalidAvatars.length) throw new Error(`Invalid cached avatars: ${invalidAvatars.join(', ')}`);
  const characters = attachAvatars(buildCharacterIndex(episodes, source.masks), manifest);
  return {
    episodes: episodes.length,
    buckets: countSourceBuckets(episodes),
    characters: characters.length,
    avatars: characters.filter((character) => character.avatar).length,
  };
}

if (require.main === module) {
  const summary = buildRelease();
  console.log(`Validated ${summary.episodes} episodes.`);
}

module.exports = { buildRelease };
