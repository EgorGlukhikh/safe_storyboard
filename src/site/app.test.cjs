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

test('participant renders as a compact focusable avatar with an accessible tooltip', () => {
  const { renderParticipant } = loadApp();
  const html = renderParticipant({ name: 'Gilroy Reid', avatar: 'assets/gilroy.png', owner: 'Arthur Weasley' });

  assert.match(html, /class="participant"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /aria-label="Gilroy Reid, игрок Arthur Weasley"/);
  assert.match(html, /class="participant-tooltip" role="tooltip"/);
  assert.match(html, /<img[^>]+width="32" height="32"/);
});

test('calendar renders collapsed year and month disclosure controls by default', () => {
  const { renderCalendar } = loadApp();
  const html = renderCalendar(episodes, new Map());

  assert.match(html, /class="year-heading"[^>]+aria-expanded="false"[^>]+aria-controls="year-1979"/);
  assert.match(html, /id="year-1979" class="year-content" hidden/);
  assert.match(html, /class="month-heading"[^>]+aria-expanded="false"[^>]+aria-controls="month-1979-12"/);
  assert.match(html, /id="month-1979-12" class="month-content" hidden/);
});

test('filtered calendar expands matching years and months automatically', () => {
  const { renderCalendar } = loadApp();
  const html = renderCalendar([episodes[0]], new Map(), { autoExpand: true });

  assert.match(html, /class="year-heading"[^>]+aria-expanded="true"/);
  assert.match(html, /id="year-1979" class="year-content">/);
  assert.match(html, /class="month-heading"[^>]+aria-expanded="true"/);
  assert.match(html, /id="month-1979-12" class="month-content">/);
});

test('disclosure toggle keeps aria state and hidden content in sync', () => {
  const { toggleDisclosure } = loadApp();
  const attributes = new Map([['aria-expanded', 'false']]);
  const button = {
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const content = { hidden: true };

  toggleDisclosure(button, content);
  assert.equal(attributes.get('aria-expanded'), 'true');
  assert.equal(content.hidden, false);

  toggleDisclosure(button, content);
  assert.equal(attributes.get('aria-expanded'), 'false');
  assert.equal(content.hidden, true);
});
