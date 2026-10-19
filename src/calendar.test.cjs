'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.join(__dirname, 'episode-source.json');

function loadCalendar() {
  return require('./calendar.cjs');
}

function loadSource() {
  return JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
}

test('normalizes all 356 episodes with unique ids and forum links', () => {
  const { normalizeEpisodes } = loadCalendar();
  const source = loadSource();
  const episodes = normalizeEpisodes(source);

  assert.equal(episodes.length, 356);
  assert.equal(new Set(episodes.map((episode) => episode.id)).size, 356);
  assert.ok(episodes.every((episode) => /^https:\/\/safespace\.rusff\.me\/viewtopic\.php\?id=\d+$/.test(episode.url)));
});

test('preserves the verified source bucket counts', () => {
  const { normalizeEpisodes, countSourceBuckets } = loadCalendar();
  const counts = countSourceBuckets(normalizeEpisodes(loadSource()));

  assert.deepEqual(counts, {
    currentPlot: 4,
    currentPersonal: 136,
    archivePlot: 22,
    archivePersonal: 194,
  });
});

test('excludes alternative and non-episode sections', () => {
  const { normalizeEpisodes } = loadCalendar();
  const episodes = normalizeEpisodes(loadSource());

  assert.ok(episodes.every((episode) => ['plot', 'personal'].includes(episode.kind)));
  assert.ok(episodes.every((episode) => ['current', 'archive'].includes(episode.state)));
  assert.ok(episodes.every((episode) => !/альтернатив/i.test(`${episode.title} ${episode.sourceSection || ''}`)));
});

test('resolves every date and leaves participants empty only for an explicit TBD roster', () => {
  const { normalizeEpisodes } = loadCalendar();
  const source = loadSource();
  const episodes = normalizeEpisodes(source);

  assert.deepEqual(episodes.filter((episode) => !episode.dateStart).map((episode) => episode.id), []);
  const empty = episodes.filter((episode) => episode.participants.length === 0);
  assert.ok(empty.length > 0);
  assert.ok(empty.every((episode) => /участник[^:]*:\s*(?:TBD|уточняется|—|-)/i.test(source.episodes.find((raw) => raw.url === episode.url).body)));
});

test('does not treat episode titles or soundtrack lines as participants', () => {
  const { parseParticipants } = loadCalendar();
  assert.deepEqual(parseParticipants('A Very Large Cat\n\nGideon Prewett & Dragon Valmont\n\nПредупреждения: none'), ['Gideon Prewett', 'Dragon Valmont']);
  assert.deepEqual(parseParticipants("Handle with Care\nDon't Hurt My Little Sister\n\nOlivin Mulciber & Morvran Avery\n\nДата: 14.07.1958"), ['Olivin Mulciber', 'Morvran Avery']);
  assert.deepEqual(parseParticipants('Wonderful Life\nAndy Williams — song\n\nAlexandrite Flint (Avery)\n& Orla Fawley\n\nДата: 24.12.1953'), ['Alexandrite Flint (Avery)', 'Orla Fawley']);
});

test('parses cinematic participant labels and honors an explicit TBD roster', () => {
  const { parseParticipants } = loadCalendar();
  assert.deepEqual(parseParticipants('Title\nВ главных ролях: James & Lily\nВ фильме также снимались: @Julia White, @Remus Lupin\nПредупреждения: много'), ['James', 'Lily', 'Julia White', 'Remus Lupin']);
  assert.deepEqual(parseParticipants('Тинворт & Тролли\nСписок участников квеста: TBD\nДата: 01.08.1979'), []);
});

test('indexes Gilroy Reid under Arthur Weasley without losing the mask identity', () => {
  const { normalizeEpisodes, buildCharacterIndex } = loadCalendar();
  const source = loadSource();
  const episodes = normalizeEpisodes(source);
  const characters = buildCharacterIndex(episodes, source.masks);
  const arthur = characters.find((character) => character.name === 'Arthur Weasley');
  const gilroy = characters.find((character) => character.name === 'Gilroy Reid');

  assert.ok(arthur);
  assert.ok(gilroy);
  assert.equal(gilroy.owner, 'Arthur Weasley');
  assert.ok(arthur.aliases.includes('Gilroy Reid'));
  assert.ok(episodes.some((episode) => episode.players.includes('Arthur Weasley') && episode.participants.includes('Gilroy Reid')));
});

test('canonicalizes Cyrillic participant spellings in episode 1248 for character filters', () => {
  const { normalizeEpisodes } = loadCalendar();
  const episode = normalizeEpisodes(loadSource()).find((item) => item.id === 1248);

  assert.ok(episode);
  assert.deepEqual(episode.participants, ['Zaxar MacFusty', 'Gilroy Reid']);
  assert.deepEqual(episode.players, ['Zaxar MacFusty', 'Arthur Weasley']);
  assert.equal(episode.state, 'current');
  assert.equal(episode.dateStart, '1979-08-11');
});
