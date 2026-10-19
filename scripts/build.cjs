'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeEpisodes, countSourceBuckets, buildCharacterIndex } = require('../src/calendar.cjs');

function buildRelease(rootDir = path.resolve(__dirname, '..')) {
  const source = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'episode-source.json'), 'utf8'));
  const episodes = normalizeEpisodes(source);
  return {
    episodes: episodes.length,
    buckets: countSourceBuckets(episodes),
    characters: buildCharacterIndex(episodes, source.masks).length,
  };
}

if (require.main === module) {
  const summary = buildRelease();
  console.log(`Validated ${summary.episodes} episodes.`);
}

module.exports = { buildRelease };
