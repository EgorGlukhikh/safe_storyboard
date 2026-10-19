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
  const docsDir = path.join(rootDir, 'docs');
  const assetsDir = path.join(docsDir, 'assets');
  const dataDir = path.join(docsDir, 'data');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.copyFileSync(path.join(rootDir, 'src', 'site', 'index.html'), path.join(docsDir, 'index.html'));
  fs.copyFileSync(path.join(rootDir, 'src', 'site', 'styles.css'), path.join(assetsDir, 'styles.css'));
  fs.copyFileSync(path.join(rootDir, 'src', 'site', 'app.js'), path.join(assetsDir, 'app.js'));
  fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(dataDir, 'episodes.json'), `${JSON.stringify({
    generatedAt: source.generatedAt,
    episodes,
    characters,
  })}\n`);
  fs.writeFileSync(path.join(rootDir, 'forum-embed.txt'), `[html]\n<iframe src="https://egorglukhikh.github.io/safe_storyboard/?v=1" title="Карта эпизодов SafeSpace" width="100%" height="1100" style="display:block;border:0;background:#f1eee5;"></iframe>\n[/html]\n`);
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
