import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sessionsDir = path.join(rootDir, 'data', 'sessions');
const synthesisPath = path.join(rootDir, 'data', 'synthesis.json');
const mediaPath = path.join(rootDir, 'data', 'media.json');
const agendaPath = path.join(rootDir, 'data', 'agenda.json');
const photosPath = path.join(rootDir, 'data', 'photos.json');
const pptPath = path.join(rootDir, 'data', 'ppt.json');
const day2Path = path.join(rootDir, 'data', 'day2-summary.json');
const bundlePath = path.join(rootDir, 'assets', 'data.js');

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

const WRONG_NAME_RE =
  /张新敏|Oraka|戈飞|戈培|拔刀流|谭少青|邵青|Frobot|Flowbot|昌河|前白科技|艾琪|爱奇在线|安美琪|杨刚|陈征|沃东方|媒介侠|智能时代联合创始人|智能时代联创|姓名待核实|每日经济新闻孵化科技公司嘉宾|微图 ?AJ|微拓一家|彭丽|光头老刘|彭丹|中天骄|Wingsee|兰书|陆浩|玉博|华道勇/;

const TS_RE = /^\d{2}:\d{2}:\d{2}$/;
const errors = [];
const assert = (cond, msg) => {
  if (!cond) errors.push(msg);
};

const sessionIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
const sessions = [];
const talkIds = new Set();

for (const sid of sessionIds) {
  const p = path.join(sessionsDir, `${sid}.json`);
  assert(fs.existsSync(p), `Missing session file: ${p}`);
  if (!fs.existsSync(p)) continue;
  const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
  sessions.push(s);
  assert(s.id === sid, `Session id mismatch: ${s.id} !== ${sid}`);
  if (['s5', 's6', 's7'].includes(sid)) {
    assert(s.day === 2, `Session ${sid} must have day === 2`);
  } else {
    assert(s.day === 1, `Session ${sid} must have day === 1`);
  }
  assert(Boolean(s.miaojiId), `Missing miaojiId in ${sid}`);
  for (const [idx, note] of (s.sessionNotes || []).entries()) {
    assert(TS_RE.test(note.ts || ''), `${sid}.sessionNotes[${idx}].ts invalid: "${note.ts}"`);
  }
  for (const t of s.talks || []) {
    assert(Boolean(t.id), `Missing talk id in ${sid}`);
    assert(!talkIds.has(t.id), `Duplicate talk id: ${t.id}`);
    talkIds.add(t.id);
    assert(Boolean(t.agendaSlot), `${t.id} missing agendaSlot`);
    assert(TS_RE.test(t.start || ''), `${t.id}.start invalid: "${t.start}"`);
    assert(TS_RE.test(t.end || ''), `${t.id}.end invalid: "${t.end}"`);
    assert(Array.isArray(t.tags) && t.tags.length >= 1 && t.tags.length <= 4, `${t.id}.tags count must be 1..4`);
    for (const tag of t.tags || []) {
      assert(VALID_TOPIC_IDS.has(tag), `${t.id} invalid tag "${tag}"`);
    }
    if (t.kind === 'talk' || t.kind === 'panel') {
      assert((t.keyPoints || []).length >= 8, `${t.id} (${t.kind}) keyPoints < 8 (${(t.keyPoints || []).length})`);
      assert((t.quotes || []).length >= 2, `${t.id} (${t.kind}) quotes < 2 (${(t.quotes || []).length})`);
      assert(Array.isArray(t.narrative) && t.narrative.length >= 4, `${t.id} (${t.kind}) narrative < 4`);
    } else {
      assert(Array.isArray(t.narrative) && t.narrative.length >= 2, `${t.id} (${t.kind}) narrative < 2`);
    }
    for (const [i, nv] of (t.narrative || []).entries()) {
      assert(Boolean(nv.heading && nv.text), `${t.id}.narrative[${i}] missing heading/text`);
      assert(TS_RE.test(nv.ts || ''), `${t.id}.narrative[${i}].ts invalid: "${nv.ts}"`);
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

  const ROUTE_RE = /^#\/(debates|quiz|methods|resources|checklist|quotes|glossary|topics|sessions|gallery)$/;
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

assert(fs.existsSync(mediaPath), 'Missing data/media.json');
if (fs.existsSync(mediaPath)) {
  const media = JSON.parse(fs.readFileSync(mediaPath, 'utf-8'));
  assert(media.length >= 16, `media count must be >= 16, got ${media.length}`);
  for (const m of media) {
    const abs = path.join(rootDir, m.file);
    assert(fs.existsSync(abs), `media file missing on disk: ${m.file}`);
    if (m.talkId) assert(talkIds.has(m.talkId), `media ${m.id} unknown talkId: ${m.talkId}`);
  }
}

assert(fs.existsSync(agendaPath), 'Missing data/agenda.json');
if (fs.existsSync(agendaPath)) {
  const agenda = JSON.parse(fs.readFileSync(agendaPath, 'utf-8'));
  assert(Array.isArray(agenda.slots) && agenda.slots.length > 0, 'agenda.slots must be non-empty');
  for (const [i, sl] of (agenda.slots || []).entries()) {
    assert(sl.day === 1 || sl.day === 2, `agenda.slots[${i}] invalid day: ${sl.day}`);
    if (sl.talkId) assert(talkIds.has(sl.talkId), `agenda.slots[${i}] unknown talkId: ${sl.talkId}`);
  }
}

assert(fs.existsSync(pptPath), 'Missing data/ppt.json');
if (fs.existsSync(pptPath)) {
  const ppt = JSON.parse(fs.readFileSync(pptPath, 'utf-8'));
  const items = ppt.items || {};
  for (const tid of talkIds) {
    assert(tid in items, `data/ppt.json missing talk entry: ${tid}`);
  }
  for (const [tid, entry] of Object.entries(items)) {
    assert(talkIds.has(tid), `data/ppt.json unknown talkId: ${tid}`);
    if (entry.status === 'ready') {
      for (const pg of entry.pages || []) {
        assert(fs.existsSync(path.join(rootDir, pg)), `ppt page missing on disk: ${pg}`);
      }
      if (entry.pdf) {
        assert(fs.existsSync(path.join(rootDir, entry.pdf)), `ppt pdf missing on disk: ${entry.pdf}`);
      }
    }
  }
}

assert(fs.existsSync(day2Path), 'Missing data/day2-summary.json');
if (fs.existsSync(day2Path)) {
  const d2 = JSON.parse(fs.readFileSync(day2Path, 'utf-8'));
  for (const [i, th] of (d2.themes || []).entries()) {
    for (const r of th.refs || []) assert(talkIds.has(r), `day2.themes[${i}] unknown ref: ${r}`);
  }
  for (const [i, c] of (d2.crossDay || []).entries()) {
    assert(talkIds.has(c.day2TalkId), `day2.crossDay[${i}] unknown day2TalkId: ${c.day2TalkId}`);
    assert(talkIds.has(c.day1TalkId), `day2.crossDay[${i}] unknown day1TalkId: ${c.day1TalkId}`);
  }
  for (const [i, d] of (d2.dataWall || []).entries()) {
    assert(talkIds.has(d.talkId), `day2.dataWall[${i}] unknown talkId: ${d.talkId}`);
    assert(TS_RE.test(d.ts || ''), `day2.dataWall[${i}] invalid ts: "${d.ts}"`);
  }
  for (const [i, q] of (d2.quotes || []).entries()) {
    assert(talkIds.has(q.talkId), `day2.quotes[${i}] unknown talkId: ${q.talkId}`);
    assert(TS_RE.test(q.ts || ''), `day2.quotes[${i}] invalid ts: "${q.ts}"`);
  }
}

assert(fs.existsSync(photosPath), 'Missing data/photos.json');
if (fs.existsSync(photosPath)) {
  const photos = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));
  const items = photos.items || [];
  assert(items.length > 0, 'data/photos.json items must be non-empty');
  const speakerStageTalks = new Set();
  const phoneRe = /1[3-9][0-9]{9}/;
  for (const [i, p] of items.entries()) {
    assert(Boolean(p.id && p.file && p.thumb), `photos[${i}] missing id/file/thumb`);
    assert(fs.existsSync(path.join(rootDir, p.file)), `photo file missing on disk: ${p.file}`);
    assert(fs.existsSync(path.join(rootDir, p.thumb)), `photo thumb missing on disk: ${p.thumb}`);
    if (p.talkId) {
      assert(talkIds.has(p.talkId), `photo ${p.id} unknown talkId: ${p.talkId}`);
      if (p.kind === 'speaker' || p.kind === 'stage') {
        speakerStageTalks.add(p.talkId);
      }
    }
    const serializedItem = JSON.stringify(p);
    assert(!phoneRe.test(serializedItem), `Privacy leak (phone number) in photo ${p.id}`);
    assert(!WRONG_NAME_RE.test(serializedItem), `Forbidden legacy name in photo ${p.id}`);
  }
  for (const s of sessions) {
    for (const t of s.talks || []) {
      if (t.kind === 'talk' || t.kind === 'panel') {
        assert(
          speakerStageTalks.has(t.id),
          `Formal talk/panel ${t.id} missing >=1 speaker or stage photo`
        );
      }
    }
  }
}

if (fs.existsSync(bundlePath)) {
  const rawJs = fs.readFileSync(bundlePath, 'utf-8');
  const prefix = 'window.GEO_DATA = ';
  assert(rawJs.startsWith(prefix), 'assets/data.js missing window.GEO_DATA prefix');
  if (rawJs.startsWith(prefix)) {
    const payload = JSON.parse(rawJs.slice(prefix.length).replace(/;\s*$/, ''));
    const clone = {
      ...payload,
      synthesis: {
        ...payload.synthesis,
        glossary: undefined,
      },
    };
    const serialized = JSON.stringify(clone, null, 2);
    for (const line of serialized.split('\n')) {
      const m = line.match(WRONG_NAME_RE);
      if (m) {
        errors.push(`Forbidden legacy/wrong name "${m[0]}" found outside glossary in assets/data.js: ${line.trim().slice(0, 80)}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Validation failed:\n' + errors.slice(0, 30).map((e) => ` - ${e}`).join('\n'));
  if (errors.length > 30) console.error(` ... and ${errors.length - 30} more errors`);
  process.exit(1);
}

console.log('OK');
