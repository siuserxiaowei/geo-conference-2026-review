import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sessionsDir = path.join(rootDir, 'data', 'sessions');
const synthesisPath = path.join(rootDir, 'data', 'synthesis.json');

const VALID_TOPIC_IDS = new Set([
  'value',
  'ai-selection',
  'method',
  'keywords-scenes',
  'content-sources',
  'measurement',
  'ecommerce-overseas',
  'provider-ops',
  'ai-trends',
  'compliance-evidence',
]);

const TS_RE = /^\d{2}:\d{2}:\d{2}$/;
const errors = [];
const assert = (cond, msg) => {
  if (!cond) errors.push(msg);
};

const sessionIds = ['s1', 's2', 's3', 's4'];
const sessions = [];
const talkIds = new Set();

for (const sid of sessionIds) {
  const p = path.join(sessionsDir, `${sid}.json`);
  assert(fs.existsSync(p), `Missing session file: ${p}`);
  if (!fs.existsSync(p)) continue;
  const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
  sessions.push(s);
  assert(s.id === sid, `Session id mismatch: ${s.id} !== ${sid}`);
  assert(Boolean(s.miaojiId), `Missing miaojiId in ${sid}`);
  for (const [idx, note] of (s.sessionNotes || []).entries()) {
    assert(TS_RE.test(note.ts || ''), `${sid}.sessionNotes[${idx}].ts invalid: "${note.ts}"`);
  }
  for (const t of s.talks || []) {
    assert(Boolean(t.id), `Missing talk id in ${sid}`);
    assert(!talkIds.has(t.id), `Duplicate talk id: ${t.id}`);
    talkIds.add(t.id);
    assert(TS_RE.test(t.start || ''), `${t.id}.start invalid: "${t.start}"`);
    assert(TS_RE.test(t.end || ''), `${t.id}.end invalid: "${t.end}"`);
    assert(Array.isArray(t.tags) && t.tags.length >= 1 && t.tags.length <= 4, `${t.id}.tags count must be 1..4`);
    for (const tag of t.tags || []) {
      assert(VALID_TOPIC_IDS.has(tag), `${t.id} invalid tag "${tag}"`);
    }
    if (t.kind === 'talk' || t.kind === 'panel') {
      assert((t.keyPoints || []).length >= 8, `${t.id} (${t.kind}) keyPoints < 8 (${(t.keyPoints || []).length})`);
      assert((t.quotes || []).length >= 2, `${t.id} (${t.kind}) quotes < 2 (${(t.quotes || []).length})`);
    }
    for (const [i, kp] of (t.keyPoints || []).entries()) {
      assert(TS_RE.test(kp.ts || ''), `${t.id}.keyPoints[${i}].ts invalid: "${kp.ts}"`);
    }
    for (const [i, d] of (t.data || []).entries()) {
      assert(TS_RE.test(d.ts || ''), `${t.id}.data[${i}].ts invalid: "${d.ts}"`);
    }
    for (const [i, c] of (t.cases || []).entries()) {
      assert(TS_RE.test(c.ts || ''), `${t.id}.cases[${i}].ts invalid: "${c.ts}"`);
    }
    for (const [i, q] of (t.quotes || []).entries()) {
      assert(TS_RE.test(q.ts || ''), `${t.id}.quotes[${i}].ts invalid: "${q.ts}"`);
    }
    for (const [i, qa] of (t.qa || []).entries()) {
      assert(TS_RE.test(qa.ts || ''), `${t.id}.qa[${i}].ts invalid: "${qa.ts}"`);
    }
  }
}

assert(fs.existsSync(synthesisPath), 'Missing data/synthesis.json');
if (fs.existsSync(synthesisPath)) {
  const syn = JSON.parse(fs.readFileSync(synthesisPath, 'utf-8'));

  const topicIds = new Set((syn.topics || []).map((t) => t.id));
  assert((syn.topics || []).length === 10, `topics count must be 10, got ${(syn.topics || []).length}`);
  for (const tid of VALID_TOPIC_IDS) {
    assert(topicIds.has(tid), `Missing topic in synthesis.topics: ${tid}`);
  }
  for (const topic of syn.topics || []) {
    for (const [i, pt] of (topic.points || []).entries()) {
      assert(Array.isArray(pt.refs) && pt.refs.length > 0, `topic ${topic.id}.points[${i}] missing refs`);
      for (const ref of pt.refs || []) {
        assert(talkIds.has(ref), `topic ${topic.id}.points[${i}] unknown talkId: ${ref}`);
      }
    }
  }

  assert((syn.methods || []).length >= 5, `methods count < 5 (${(syn.methods || []).length})`);
  for (const [i, m] of (syn.methods || []).entries()) {
    assert(talkIds.has(m.talkId), `methods[${i}] unknown talkId: ${m.talkId}`);
  }

  assert((syn.debates || []).length >= 4, `debates count < 4 (${(syn.debates || []).length})`);
  for (const [i, d] of (syn.debates || []).entries()) {
    for (const sideKey of ['sideA', 'sideB']) {
      const side = d[sideKey];
      assert(Boolean(side), `debates[${i}] missing ${sideKey}`);
      const items = Array.isArray(side) ? side : [side];
      for (const item of items) {
        assert(talkIds.has(item.talkId), `debates[${i}].${sideKey} unknown talkId: ${item.talkId}`);
        assert(TS_RE.test(item.ts || ''), `debates[${i}].${sideKey} invalid ts: "${item.ts}"`);
      }
    }
  }

  assert((syn.dataWall || []).length >= 24, `dataWall count < 24 (${(syn.dataWall || []).length})`);
  for (const [i, d] of (syn.dataWall || []).entries()) {
    assert(talkIds.has(d.talkId), `dataWall[${i}] unknown talkId: ${d.talkId}`);
    assert(TS_RE.test(d.ts || ''), `dataWall[${i}] invalid ts: "${d.ts}"`);
  }

  assert((syn.quotes || []).length >= 15, `quotes count < 15 (${(syn.quotes || []).length})`);
  for (const [i, q] of (syn.quotes || []).entries()) {
    assert(talkIds.has(q.talkId), `quotes[${i}] unknown talkId: ${q.talkId}`);
    assert(TS_RE.test(q.ts || ''), `quotes[${i}] invalid ts: "${q.ts}"`);
  }

  const ROUTE_RE = /^#\/(debates|quiz|methods|resources|checklist|quotes|glossary|topics|sessions)$/;
  assert((syn.paths || []).length === 3, `paths count must be 3, got ${(syn.paths || []).length}`);
  for (const p of syn.paths || []) {
    assert((p.steps || []).length >= 6 && (p.steps || []).length <= 10, `path ${p.id} steps must be 6..10`);
    for (const [i, st] of (p.steps || []).entries()) {
      if (st.talkId) assert(talkIds.has(st.talkId), `path ${p.id}.steps[${i}] unknown talkId: ${st.talkId}`);
      if (st.topicId) assert(topicIds.has(st.topicId), `path ${p.id}.steps[${i}] unknown topicId: ${st.topicId}`);
      if (st.route) assert(ROUTE_RE.test(st.route), `path ${p.id}.steps[${i}] invalid route: ${st.route}`);
      assert(Boolean(st.talkId || st.topicId || st.route), `path ${p.id}.steps[${i}] must reference talkId, topicId, or route`);
    }
  }

  assert((syn.quiz || []).length === 20, `quiz count must be 20, got ${(syn.quiz || []).length}`);
  for (const [i, q] of (syn.quiz || []).entries()) {
    assert(Array.isArray(q.options) && q.options.length === 4, `quiz[${i}] must have 4 options`);
    assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, `quiz[${i}] invalid answer: ${q.answer}`);
    assert(talkIds.has(q.refTalkId), `quiz[${i}] unknown refTalkId: ${q.refTalkId}`);
  }

  assert((syn.checklist || []).length === 15, `checklist count must be 15, got ${(syn.checklist || []).length}`);
}

if (errors.length > 0) {
  console.error('Validation failed:\n' + errors.map((e) => ` - ${e}`).join('\n'));
  process.exit(1);
}

console.log('OK');
