// S4 forced-choice set builder. Per read-gate-thresholds.json blindRead.forcedChoice:
// K=3 distractors -> 4-way choice; target correctly identified on ALL 3 rerolls.
// Spec (from task): set k target = [seed1,reroll1,reroll2][k-1]; targetLetter =
// ['B','D','A'][k-1]; the 3 distractors fill the remaining slots in ROTATED order
// (rotation k-1 of [rocky,ocean,europa]). Copies are BYTE-COPIES of the committed
// disc-only crops; byte-match asserted post-copy. The answer key is NOT written here
// (it lives only in the driver's return, so the blind agents cannot read it).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const CROPS = path.join(DIR, 'crops');
const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');

const targets = ['target-seed1','target-reroll1','target-reroll2'];
const targetLetters = ['B','D','A'];
const distractors = ['distractor-rocky','distractor-ocean','distractor-europa'];
const LETTERS = ['A','B','C','D'];

const answerKey = {};
const verify = [];

for (let k=0; k<3; k++) {
  const setName = 'set'+(k+1);
  const setDir = path.join(CROPS, setName);
  fs.mkdirSync(setDir, { recursive: true });
  // rotate distractors by k
  const rot = distractors.slice(k).concat(distractors.slice(0,k));
  // assign: target at targetLetters[k], distractors fill remaining letters in order
  const tLetter = targetLetters[k];
  const remaining = LETTERS.filter(l => l !== tLetter);
  const assignment = {};
  assignment[tLetter] = targets[k];
  remaining.forEach((l,i) => { assignment[l] = rot[i]; });
  answerKey[setName] = tLetter;
  // copy + verify byte-match
  for (const l of LETTERS) {
    const srcName = assignment[l] + '.crop.png';
    const src = path.join(CROPS, srcName);
    const dst = path.join(setDir, 'img'+l+'.png');
    fs.copyFileSync(src, dst);
    const same = md5(src) === md5(dst);
    verify.push({ set:setName, letter:l, source:srcName, byteMatch:same, isTarget:(l===tLetter) });
  }
}

const allMatch = verify.every(v => v.byteMatch);
console.log(JSON.stringify({ answerKey, allByteMatch: allMatch, assignments: verify }, null, 2));
