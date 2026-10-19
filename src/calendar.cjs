'use strict';

const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function clean(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function isoDate(year, month, day) {
  const y = Number(year) < 100 ? 1900 + Number(year) : Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 1900 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const candidate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const date = new Date(`${candidate}T00:00:00Z`);
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d ? candidate : null;
}

function dateResult(dateLabel, dateStart, dateEnd = null, datePrecision = 'day', note = null) {
  return { dateLabel, dateStart, dateEnd, datePrecision, note };
}

function parseDate(body, fallbackTitle = '') {
  const lines = String(body || '').split(/\r?\n/).map(clean).filter(Boolean);
  const explicit = lines.find((line) => /^(?:дата(?: и место)?|время(?: и место)?|дата эпизода)\s*:/i.test(line));
  const sources = explicit ? [explicit.replace(/^[^:]+:\s*/i, ''), clean(fallbackTitle)] : [clean(fallbackTitle)];
  for (const source of sources) {
    let match = source.match(/\b(\d{1,2})[.\/]\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})[.\/]\s*(\d{1,2})[.\/]\s*(\d{2,4})\b/);
    if (match) {
      const start = isoDate(match[5], match[2], match[1]);
      const end = isoDate(match[5], match[4], match[3]);
      if (start && end) return dateResult(match[0], start, end, 'range');
    }
    match = source.match(/\b(\d{1,2})\s*[-–—]\s*(\d{1,2})[.\/]\s*(\d{1,2})[.\/]\s*(\d{2,4})\b/);
    if (match) {
      const start = isoDate(match[4], match[3], match[1]);
      const end = isoDate(match[4], match[3], match[2]);
      if (start && end) return dateResult(match[0], start, end, 'range');
    }
    match = source.match(/\b(\d{1,2})[.\/]\s*(\d{1,2})[.\/]\s*(\d{2,4})\b/);
    if (match) {
      const value = isoDate(match[3], match[2], match[1]);
      if (value) return dateResult(match[0], value);
    }
    match = source.match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})\b/i);
    if (match) {
      const value = isoDate(match[3], MONTHS_GENITIVE.indexOf(match[2].toLowerCase()) + 1, match[1]);
      if (value) return dateResult(match[0], value);
    }
    match = source.match(/\b(19\d{2}|20\d{2})\s*[-–—]\s*(19\d{2}|20\d{2})\b/);
    if (match) return dateResult(match[0], `${match[1]}-01-01`, `${match[2]}-12-31`, 'range');
    match = source.match(/\b(19\d{2}|20\d{2})\b/);
    if (match) return dateResult(match[0], `${match[1]}-01-01`, null, 'year');
  }
  return dateResult('Дата не указана', null, null, 'unknown', 'Дата требует проверки');
}

function looksLikeNames(line) {
  if (!line || line.length > 240 || /^(?:предупреждения|дата|описание|место|подпись|ост|саундтрек|цитата|время|обсуждение)\s*:/i.test(line)) return false;
  if (/^(?:подпись автора|правила|статы|техническая информация|внутренняя информация)$/i.test(line)) return false;
  if (/[!?«»❝❞]/.test(line)) return false;
  if (/^\([^()]+(?:,[^()]+)+\)$/.test(line)) return true;
  if (/^(?:участники|действующие лица)\s*:/i.test(line)) return true;
  if (/^&\s*[A-ZА-ЯЁ][\p{L}'’.-]+(?:\s+[A-ZА-ЯЁ][\p{L}'’.-]+)+$/u.test(line)) return true;
  const comparable = line.replace(/\([^)]*\)/g, '').trim();
  const tokens = comparable.replace(/[@&,+/]/g, ' ').split(/\s+/).filter(Boolean);
  const capitals = tokens.filter((token) => /^[A-ZА-ЯЁ][\p{L}'’.-]*$/u.test(token));
  if ((line.match(/@/g) || []).length >= 2) return true;
  if (/[@&]/.test(line)) {
    const chunks = line.split('&').map((part) => clean(part.replace(/^@/, ''))).filter(Boolean);
    return chunks.length >= 2 && chunks.every((part) => /\p{L}/u.test(part) && part.split(/\s+/).length <= 8);
  }
  if (/,/.test(line)) {
    const proper = line.split(',').filter((part) => {
      const words = clean(part).split(/\s+/).filter(Boolean);
      return words.length >= 2 && words.length <= 5 && words.every((word) => /^[A-ZА-ЯЁ][\p{L}'’.-]*$/u.test(word));
    });
    return proper.length >= 2;
  }
  return tokens.length >= 2 && tokens.length <= 8 && capitals.length === tokens.length;
}

function splitNames(text) {
  const normalized = clean(text).replace(/^\((.*)\)$/s, '$1').replace(/^[•·\s]+/, '').replace(/^&\s*/, '').replace(/\s+(?:anf|and)\s+other.*$/i, '').replace(/^(?:участники|действующие лица|в главных ролях|в фильме также снимались)\s*:\s*/i, '');
  if (/^(?:все желающие|все|любой желающий)/i.test(normalized)) return [normalized];
  return normalized.split(/\s*(?:&|,|\+|\/|\band\b)\s*|\s+(?=@)/i)
    .map((name) => clean(name.replace(/^@/, '').replace(/[.;]+$/, '')))
    .filter((name) => name && name.length <= 80 && !/^(?:NPC|НПС|все|все желающие|кому.*)$/i.test(name));
}

function parseParticipants(body) {
  const lines = String(body || '').split(/\r?\n/).map(clean).filter(Boolean);
  const healthIndex = lines.findIndex((line) => /^здоровье персонажей$/i.test(line));
  if (healthIndex >= 0) {
    const roster = [];
    for (let i = healthIndex + 1; i + 2 < lines.length && /^\d+\s*hp$/i.test(lines[i + 2]); i += 3) roster.push(`${lines[i]} ${lines[i + 1]}`);
    if (roster.length) return roster;
  }
  const boundary = lines.findIndex((line, index) => /^(?:предупреждения|дата(?: и место)?|описание эпизода|место|время)\s*:/i.test(line) || (index > 1 && /\b\d{1,2}\s*[-–—.]\s*\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/.test(line)));
  const candidates = lines.slice(0, boundary < 0 ? Math.min(lines.length, 12) : boundary);
  const cinematic = candidates.filter((line) => /^(?:в главных ролях|в фильме также снимались)\s*:/i.test(line));
  if (cinematic.length) return [...new Set(cinematic.flatMap(splitNames))];
  const invited = candidates.find((line) => /(?:для господ|приглашены|играют)\s*:/i.test(line));
  if (invited) return [...new Set(splitNames(invited.replace(/^.*?(?:для господ|приглашены|играют)\s*:\s*/i, '')))];
  const labeled = candidates.find((line) => /^(?:(?:список\s+)?участник[^:]*|действующие лица)\s*:/i.test(line));
  if (labeled) return [...new Set(splitNames(labeled.replace(/^[^:]+:\s*/, '')).filter((name) => !/^(?:TBD|уточняется|—|-)$/i.test(name)))];
  const nameLines = candidates.filter(looksLikeNames);
  let end = candidates.length - 1;
  while (end >= 0 && !looksLikeNames(candidates[end])) end -= 1;
  const selected = [];
  while (end >= 0 && looksLikeNames(candidates[end])) {
    selected.unshift(candidates[end]);
    end -= 1;
  }
  if (!selected.length && nameLines.length) selected.push(nameLines.at(-1));
  let parsed = [...new Set(selected.flatMap(splitNames))];
  if (parsed.length > 1) {
    const headings = new Set(lines.slice(0, 2).filter((line) => !/[@&,+:]/.test(line)).map((line) => line.toLowerCase()));
    parsed = parsed.filter((name) => !headings.has(name.toLowerCase()));
  }
  return parsed;
}

function buildMaskIndex(masks = []) {
  const ownerByCharacter = {};
  const charactersByOwner = {};
  for (const item of masks) {
    const owner = clean(item.owner);
    const mask = clean(item.mask);
    if (!owner || !mask) continue;
    ownerByCharacter[mask.toLowerCase()] = owner;
    const key = owner.toLowerCase();
    charactersByOwner[key] ||= [];
    if (!charactersByOwner[key].includes(mask)) charactersByOwner[key].push(mask);
  }
  return { ownerByCharacter, charactersByOwner };
}

function extractField(body, label, stopLabels) {
  const lines = String(body || '').split(/\r?\n/).map(clean).filter(Boolean);
  const start = lines.findIndex((line) => new RegExp(`^${label}\\s*:`, 'i').test(line));
  if (start < 0) return '';
  const first = lines[start].replace(/^[^:]+:\s*/, '');
  const rest = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (new RegExp(`^(?:${stopLabels})\\s*:`, 'i').test(lines[i]) || /^(?:подпись автора|правила|техническая информация)$/i.test(lines[i])) break;
    rest.push(lines[i]);
  }
  return clean([first, ...rest].join(' '));
}

function normalizeEpisode(source, maskIndex, nameAliases = {}) {
  const parsed = parseDate(source.body, source.title);
  const participants = parseParticipants(source.body).map((character) => nameAliases[character.toLowerCase()] || character);
  const players = [...new Set(participants.map((character) => maskIndex.ownerByCharacter[character.toLowerCase()] || character))];
  const idMatch = source.url.match(/[?&]id=(\d+)/);
  const rawTitle = clean(source.title);
  const title = clean(rawTitle.replace(/^\[?\d{1,4}(?:[.\/-]\d{1,2})?(?:[.\/-]\d{2,4})?\]?\s*[-–—,]?\s*/, '')) || rawTitle;
  const parseNotes = [];
  if (parsed.note) parseNotes.push(parsed.note);
  if (!participants.length) parseNotes.push('Участники требуют проверки');
  const dateLine = String(source.body || '').split(/\r?\n/).map(clean).find((line) => /^дата и место\s*:/i.test(line)) || '';
  const location = dateLine ? clean(dateLine.replace(/^дата и место\s*:\s*/i, '').replace(parsed.dateLabel, '').replace(/^[,;\s-]+/, '')) : '';
  const description = extractField(source.body, 'Описание эпизода', 'Предупреждения|Дата(?: и место)?|Обсуждение|Тема обсуждения');
  return {
    id: Number(idMatch ? idMatch[1] : 0), title, rawTitle, url: source.url,
    sourceSection: `${source.status}:${source.type}`,
    kind: source.type === 'сюжетный' ? 'plot' : 'personal',
    state: source.status === 'текущий' ? 'current' : 'archive',
    dateLabel: parsed.dateLabel, dateStart: parsed.dateStart, dateEnd: parsed.dateEnd,
    datePrecision: parsed.datePrecision, participants, players, location, description, parseNotes,
  };
}

function normalizeEpisodes(source) {
  const maskIndex = buildMaskIndex(source.masks || []);
  const nameAliases = Object.fromEntries(Object.entries(source.nameAliases || {}).map(([alias, canonical]) => [clean(alias).toLowerCase(), clean(canonical)]));
  return (source.episodes || []).map((episode) => normalizeEpisode(episode, maskIndex, nameAliases)).sort((a, b) => a.dateStart.localeCompare(b.dateStart) || a.title.localeCompare(b.title, 'ru'));
}

function countSourceBuckets(episodes) {
  const counts = { currentPlot: 0, currentPersonal: 0, archivePlot: 0, archivePersonal: 0 };
  for (const episode of episodes) {
    const key = `${episode.state}${episode.kind[0].toUpperCase()}${episode.kind.slice(1)}`;
    counts[key] += 1;
  }
  return counts;
}

function buildCharacterIndex(episodes, masks = []) {
  const maskIndex = buildMaskIndex(masks);
  const names = new Set(episodes.flatMap((episode) => [...episode.participants, ...episode.players]));
  for (const mask of masks) {
    names.add(clean(mask.owner));
    names.add(clean(mask.mask));
  }
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'en')).map((name) => {
    const owner = maskIndex.ownerByCharacter[name.toLowerCase()] || null;
    return {
      name,
      owner,
      aliases: maskIndex.charactersByOwner[name.toLowerCase()] || [],
      avatar: null,
    };
  });
}

module.exports = {
  parseDate,
  parseParticipants,
  buildMaskIndex,
  normalizeEpisode,
  normalizeEpisodes,
  countSourceBuckets,
  buildCharacterIndex,
};
