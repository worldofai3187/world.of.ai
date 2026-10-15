/**
 * test/reply-metadata.test.mjs — unit tests for lib/reply-metadata.ts
 * (review 2026-10-15, task A). Run: node --experimental-strip-types test/reply-metadata.test.mjs
 */
import { parseReplyMetadata } from '../lib/reply-metadata.ts';

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.error(`FAIL ${name}`, extra ?? ''); }
}

// 1. EMOSI before KENANG (order A)
let r = parseReplyMetadata('Halo, aku di sini.\nEMOSI: senang 7\nKENANG: User suka kopi');
check('order: emosi-first strips both', r.reply === 'Halo, aku di sini.', r.reply);
check('order: emosi-first kenang kept', r.kenang === 'User suka kopi', r.kenang);
check('order: emosi-first emotion kept', r.emosiWord === 'senang' && r.emosiIntensity === 7, r);

// 2. KENANG before EMOSI (order B)
r = parseReplyMetadata('Halo!\nKENANG: User punya adik\nEMOSI: netral 2');
check('order: kenang-first strips both', r.reply === 'Halo!', r.reply);
check('order: kenang-first kenang kept', r.kenang === 'User punya adik', r.kenang);
check('order: kenang-first emotion kept', r.emosiWord === 'netral' && r.emosiIntensity === 2, r);

// 3. Metadata at the very start of the text (no leading newline)
r = parseReplyMetadata('KENANG: User di Jakarta\nBalasan asli di sini.');
check('start-of-text: metadata stripped', r.reply === 'Balasan asli di sini.', r.reply);
check('start-of-text: kenang kept', r.kenang === 'User di Jakarta', r.kenang);

// 4. Missing metadata: reply intact and non-empty, nothing saved
r = parseReplyMetadata('Ini balasan biasa tanpa metadata.');
check('missing: reply intact', r.reply === 'Ini balasan biasa tanpa metadata.', r.reply);
check('missing: no kenang', r.kenang === null, r.kenang);
check('missing: no emotion', r.emosiWord === null && r.emosiIntensity === null, r);

// 5. Invalid emotion: word only, no number
r = parseReplyMetadata('Hai.\nEMOSI: sedih');
check('invalid: no-number dropped', r.emosiWord === null && r.emosiIntensity === null, r);
check('invalid: no-number reply intact', r.reply === 'Hai.', r.reply);
check('invalid: no-number kenang null', r.kenang === null, r.kenang);

// 6. Invalid emotion: out of range
r = parseReplyMetadata('Hai.\nEMOSI: marah 15');
check('invalid: out-of-range dropped', r.emosiWord === null && r.emosiIntensity === null, r);

// 7. Invalid emotion: non-numeric intensity
r = parseReplyMetadata('Hai.\nEMOSI: marah banyak');
check('invalid: non-numeric dropped', r.emosiWord === null && r.emosiIntensity === null, r);

// 8. Metadata-only reply: user never sees the metadata, never an empty bubble
r = parseReplyMetadata('KENANG: User suka musik\nEMOSI: senang 5');
check('metadata-only: placeholder, no leak', r.reply === '(…)', r.reply);
check('metadata-only: values kept', r.kenang === 'User suka musik' && r.emosiIntensity === 5, r);

// 9. Empty EMOSI line is dropped, does not wipe the reply
r = parseReplyMetadata('Halo.\nEMOSI:');
check('empty-emosi: dropped', r.emosiWord === null, r);
check('empty-emosi: reply intact', r.reply === 'Halo.', r.reply);

if (failures > 0) { console.error(`\n${failures} test(s) FAILED`); process.exit(1); }
console.log('\nAll tests passed.');
