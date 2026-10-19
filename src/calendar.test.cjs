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

test('resolves a date and at least one participant for every episode', () => {
  const { normalizeEpisodes } = loadCalendar();
  const episodes = normalizeEpisodes(loadSource());

  assert.deepEqual(episodes.filter((episode) => !episode.dateStart).map((episode) => episode.id), []);
  assert.deepEqual(episodes.filter((episode) => episode.participants.length === 0).map((episode) => episode.id), []);
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
