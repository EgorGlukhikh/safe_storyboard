'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeEpisodes, buildCharacterIndex } = require('../src/calendar.cjs');
const { validateRaster, mergeAvatarManifest, slugifyCharacter } = require('../src/avatars.cjs');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'src', 'episode-source.json'), 'utf8'));
const candidates = JSON.parse(fs.readFileSync(path.join(root, 'src', 'avatar-sources.json'), 'utf8'));
const manifestPath = path.join(root, 'src', 'avatar-manifest.json');
const avatarDir = path.join(root, 'docs', 'assets', 'avatars');
const characters = buildCharacterIndex(normalizeEpisodes(source), source.masks);
const wanted = new Set(characters.map((character) => character.name.toLowerCase()));
const selected = candidates.filter((item) => wanted.has(item.name.toLowerCase()));

fs.mkdirSync(avatarDir, { recursive: true });

async function download(item) {
  try {
    const response = await fetch(item.avatar, { redirect: 'follow', headers: { 'user-agent': 'SafeSpaceStoryboard/1.0' } });
    if (!response.ok) return { character: item.name, error: `HTTP ${response.status}` };
    const bytes = Buffer.from(await response.arrayBuffer());
    const raster = validateRaster(bytes);
    if (!raster) return { character: item.name, error: 'unsupported image bytes' };
    const fileName = `${slugifyCharacter(item.name)}${raster.extension}`;
    fs.writeFileSync(path.join(avatarDir, fileName), bytes);
    return {
      character: item.name,
      sourceUrl: item.avatar,
      localPath: `assets/avatars/${fileName}`,
      format: raster.format,
      verifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    return { character: item.name, error: error.message };
  }
}

async function main() {
  const discovered = [];
  for (let index = 0; index < selected.length; index += 8) {
    discovered.push(...await Promise.all(selected.slice(index, index + 8).map(download)));
  }
  const existing = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const manifest = mergeAvatarManifest(existing, discovered);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const failures = discovered.filter((item) => item.error);
  console.log(`Cached ${Object.keys(manifest).length}/${selected.length} matching avatars; ${failures.length} unavailable.`);
  for (const failure of failures) console.log(`- ${failure.character}: ${failure.error}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
