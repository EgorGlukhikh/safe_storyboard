'use strict';

(function initModule(globalObject) {
  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('ru');
  }

  function filterEpisodes(episodes, filters = {}) {
    const year = String(filters.year || '');
    const month = String(filters.month || '');
    const person = normalize(filters.person);
    const query = normalize(filters.search);
    return episodes.filter((episode) => {
      const date = episode.dateStart || '';
      if (year && !date.startsWith(`${year}-`)) return false;
      if (month && date.slice(5, 7) !== month.padStart(2, '0')) return false;
      if (filters.kind && episode.kind !== filters.kind) return false;
      if (filters.state && episode.state !== filters.state) return false;
      if (person && ![...episode.participants, ...episode.players].some((name) => normalize(name) === person)) return false;
      if (query) {
        const haystack = normalize([episode.title, episode.description, episode.location, ...episode.participants, ...episode.players].join(' '));
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function groupEpisodes(episodes) {
    const sorted = [...episodes].sort((a, b) => a.dateStart.localeCompare(b.dateStart) || a.title.localeCompare(b.title, 'ru'));
    const years = new Map();
    for (const episode of sorted) {
      const [yearValue, monthValue] = episode.dateStart.split('-').map(Number);
      if (!years.has(yearValue)) years.set(yearValue, new Map());
      const months = years.get(yearValue);
      if (!months.has(monthValue)) months.set(monthValue, new Map());
      const dates = months.get(monthValue);
      if (!dates.has(episode.dateStart)) dates.set(episode.dateStart, []);
      dates.get(episode.dateStart).push(episode);
    }
    return [...years.entries()].map(([year, months]) => ({
      year,
      months: [...months.entries()].map(([month, dates]) => ({
        month,
        dates: [...dates.entries()].map(([date, dateEpisodes]) => ({ date, episodes: dateEpisodes })),
      })),
    }));
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  }

  function renderParticipant(character) {
    const name = escapeText(character.name);
    const owner = character.owner && character.owner !== character.name ? `<small>${escapeText(character.owner)}</small>` : '';
    const visual = character.avatar
      ? `<img src="${escapeText(character.avatar)}" alt="" loading="lazy" width="40" height="40">`
      : `<span class="participant-placeholder" aria-hidden="true">${escapeText(initials(character.name))}</span>`;
    return `<span class="participant">${visual}<span>${name}${owner}</span></span>`;
  }

  function formatDate(dateValue, dateEnd) {
    const [year, month, day] = dateValue.split('-').map(Number);
    const start = `${day} ${MONTHS_GENITIVE[month - 1]} ${year}`;
    if (!dateEnd || dateEnd === dateValue) return start;
    const [endYear, endMonth, endDay] = dateEnd.split('-').map(Number);
    return `${start} — ${endDay} ${MONTHS_GENITIVE[endMonth - 1]} ${endYear}`;
  }

  function episodeCard(episode, characterMap) {
    const participants = episode.participants.map((name) => renderParticipant(characterMap.get(normalize(name)) || { name, owner: null, avatar: null })).join('');
    const badges = `<span class="badge badge-${escapeText(episode.kind)}">${episode.kind === 'plot' ? 'сюжетный' : 'личный'}</span><span class="badge">${episode.state === 'current' ? 'текущий' : 'архив'}</span>`;
    return `<article class="episode-card" data-episode-id="${episode.id}"><div class="episode-meta">${badges}</div><h4><a href="${escapeText(episode.url)}" target="_blank" rel="noopener">${escapeText(episode.title)}</a></h4><p class="episode-date">${escapeText(formatDate(episode.dateStart, episode.dateEnd))}${episode.location ? ` · ${escapeText(episode.location)}` : ''}</p><div class="participants">${participants}</div>${episode.description ? `<p class="episode-description">${escapeText(episode.description)}</p>` : ''}</article>`;
  }

  function renderCalendar(episodes, characterMap) {
    const groups = groupEpisodes(episodes);
    if (!groups.length) return '<div class="empty-state"><strong>Ничего не найдено</strong><span>Попробуйте убрать часть фильтров.</span></div>';
    return groups.map((year) => `<section class="year-section"><header class="year-heading"><span>Хронология</span><h2>${year.year}</h2><b>${year.months.reduce((sum, month) => sum + month.dates.reduce((count, date) => count + date.episodes.length, 0), 0)} эп.</b></header>${year.months.map((month) => `<section class="month-section"><h3><span>${String(month.month).padStart(2, '0')}</span>${MONTHS[month.month - 1]}</h3>${month.dates.map((date) => `<div class="date-row"><time datetime="${date.date}">${Number(date.date.slice(8, 10))}</time><div class="date-episodes">${date.episodes.map((episode) => episodeCard(episode, characterMap)).join('')}</div></div>`).join('')}</section>`).join('')}</section>`).join('');
  }

  function fillSelect(select, values, label) {
    select.innerHTML = `<option value="">${label}</option>${values.map(({ value, text }) => `<option value="${escapeText(value)}">${escapeText(text)}</option>`).join('')}`;
  }

  async function bootstrap() {
    const response = await globalObject.fetch('data/episodes.json');
    if (!response.ok) throw new Error(`Не удалось загрузить карту: HTTP ${response.status}`);
    const data = await response.json();
    const controls = Object.fromEntries(['year', 'month', 'person', 'kind', 'state', 'search'].map((name) => [name, document.querySelector(`[name="${name}"]`)]));
    const characterMap = new Map(data.characters.map((character) => [normalize(character.name), character]));
    fillSelect(controls.year, [...new Set(data.episodes.map((episode) => episode.dateStart.slice(0, 4)))].sort().map((value) => ({ value, text: value })), 'Все годы');
    fillSelect(controls.month, MONTHS.map((text, index) => ({ value: String(index + 1), text })), 'Все месяцы');
    fillSelect(controls.person, data.characters.filter((character) => data.episodes.some((episode) => [...episode.participants, ...episode.players].includes(character.name))).map((character) => ({ value: character.name, text: character.owner ? `${character.name} · ${character.owner}` : character.name })), 'Все участники');
    const output = document.querySelector('#calendar');
    const count = document.querySelector('#result-count');
    const update = () => {
      const filtered = filterEpisodes(data.episodes, Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value])));
      output.innerHTML = renderCalendar(filtered, characterMap);
      count.textContent = `${filtered.length} из ${data.episodes.length}`;
    };
    document.querySelector('#filters').addEventListener('input', update);
    document.querySelector('#filters').addEventListener('change', update);
    document.querySelector('#reset-filters').addEventListener('click', () => {
      document.querySelector('#filters').reset();
      update();
    });
    update();
  }

  const api = { escapeText, filterEpisodes, groupEpisodes, renderParticipant, renderCalendar, formatDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    globalObject.SafeStoryboard = api;
    document.addEventListener('DOMContentLoaded', () => bootstrap().catch((error) => {
      document.querySelector('#calendar').innerHTML = `<div class="empty-state"><strong>Карта не загрузилась</strong><span>${escapeText(error.message)}</span></div>`;
    }));
  }
})(typeof window === 'undefined' ? globalThis : window);
