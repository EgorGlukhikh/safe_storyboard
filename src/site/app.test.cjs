'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadApp() {
  return require('./app.js');
}

const episodes = [
  {
    id: 1, title: 'Masked meeting', description: 'Safe', location: 'London',
    dateStart: '1979-12-12', dateEnd: null, participants: ['Gilroy Reid', 'Molly Weasley'],
    players: ['Arthur Weasley', 'Molly Weasley'], kind: 'personal', state: 'current',
  },
  {
    id: 2, title: 'Archive plot', description: 'Past', location: 'Hogwarts',
    dateStart: '1980-01-03', dateEnd: null, participants: ['James Potter'],
    players: ['James Potter'], kind: 'plot', state: 'archive',
  },
];

test('escapes forum-derived text before rendering', () => {
  const { escapeText, renderParticipant } = loadApp();
  assert.equal(escapeText('<script>&"\''), '&lt;script&gt;&amp;&quot;&#39;');
  assert.doesNotMatch(renderParticipant({ name: '<img onerror=alert(1)>', avatar: null, owner: null }), /<img onerror/);
});

test('empty filters return every episode', () => {
  const { filterEpisodes } = loadApp();
  assert.deepEqual(filterEpisodes(episodes, {}), episodes);
});

test('impossible filters return an empty result', () => {
  const { filterEpisodes } = loadApp();
  assert.deepEqual(filterEpisodes(episodes, { year: '1975', person: 'Nobody' }), []);
});

test('owner filter matches episodes played through a mask', () => {
  const { filterEpisodes } = loadApp();
  assert.deepEqual(filterEpisodes(episodes, { person: 'Arthur Weasley' }).map((episode) => episode.id), [1]);
  assert.deepEqual(filterEpisodes(episodes, { person: 'Gilroy Reid' }).map((episode) => episode.id), [1]);
});

test('groups episodes by chronological year month and date', () => {
  const { groupEpisodes } = loadApp();
  const groups = groupEpisodes([episodes[1], episodes[0]]);
  assert.deepEqual(groups.map((year) => year.year), [1979, 1980]);
  assert.equal(groups[0].months[0].month, 12);
  assert.equal(groups[0].months[0].dates[0].date, '1979-12-12');
  assert.deepEqual(groups[0].months[0].dates[0].episodes.map((episode) => episode.id), [1]);
});

test('missing avatar renders a neutral initial placeholder', () => {
  const { renderParticipant } = loadApp();
  const html = renderParticipant({ name: 'Molly Weasley', avatar: null, owner: null });
  assert.match(html, /participant-placeholder/);
  assert.match(html, />MW</);
  assert.doesNotMatch(html, /<img/);
});
