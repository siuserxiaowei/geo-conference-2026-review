import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sessionsDir = path.join(rootDir, 'data', 'sessions');
const synthesisPath = path.join(rootDir, 'data', 'synthesis.json');
const outPath = path.join(rootDir, 'assets', 'data.js');

const sessionIds = ['s1', 's2', 's3', 's4'];
const sessions = sessionIds.map((id) => {
  const filePath = path.join(sessionsDir, `${id}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
});

const synthesis = JSON.parse(fs.readFileSync(synthesisPath, 'utf-8'));

const payload = {
  generatedAt: new Date().toISOString(),
  sessions,
  synthesis,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `window.GEO_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  'utf-8'
);

const talkCount = sessions.reduce((sum, s) => sum + (s.talks?.length || 0), 0);
console.log(
  `Built ${path.relative(rootDir, outPath)} (${sessions.length} sessions, ${talkCount} talks)`
);
