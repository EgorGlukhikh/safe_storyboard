'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildRelease } = require('../scripts/build.cjs');

const root = path.join(__dirname, '..');
const docs = path.join(root, 'docs');

function releaseHashes() {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else files.push(path.relative(root, fullPath).replaceAll('\\', '/'));
    }
  }
  visit(docs);
  files.push('forum-embed.txt');
  return Object.fromEntries(files.sort().map((file) => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
}

test('build emits a Pages release with relative subpath-safe assets', () => {
  buildRelease(root);
  assert.ok(fs.existsSync(path.join(docs, '.nojekyll')));
  const html = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
  assert.match(html, /href="assets\/styles\.css"/);
  assert.match(html, /src="assets\/app\.js"/);
  assert.doesNotMatch(html, /(?:href|src)="\//);
  const app = fs.readFileSync(path.join(docs, 'assets', 'app.js'), 'utf8');
  assert.match(app, /fetch\('data\/episodes\.json'\)/);
});

test('forum embed is compact and targets the exact versioned Pages URL', () => {
  buildRelease(root);
  const embed = fs.readFileSync(path.join(root, 'forum-embed.txt'), 'utf8');
  assert.ok(embed.length < 65000);
  assert.equal((embed.match(/<iframe\b/g) || []).length, 1);
  assert.match(embed, /src="https:\/\/egorglukhikh\.github\.io\/safe_storyboard\/\?v=1"/);
  assert.doesNotMatch(embed, /episode-source|participants|password|sessionid|PHPSESSID/i);
});

test('two builds produce byte-identical release artifacts', () => {
  buildRelease(root);
  const first = releaseHashes();
  buildRelease(root);
  const second = releaseHashes();
  assert.deepEqual(second, first);
});
