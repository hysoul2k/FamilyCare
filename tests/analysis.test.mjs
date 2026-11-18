import test from 'node:test';
import assert from 'node:assert/strict';
import {parseImport, analyzeContent, trainClassifier, classifyMessages, evaluateClassifier} from '../lib/analysis.mjs';

const input = (content, extra={}) => ({source:'manual', consent:true, content,...extra});
const examples = () => ['neutral','bullying','scam','threat'].flatMap((label) => Array.from({length:5},(_,i)=>({label,text:`${{neutral:'học bài vui vẻ',bullying:'đồ ngu cút đi',scam:'chuyển tiền nhận thưởng',threat:'tao sẽ giết mày'}[label]} mẫu ${i}`})));

test('imports Unicode lines as inert text and preserves JSON speaker and date',()=>{
  const result= parseImport(input('Xin chào\n<script>globalThis.compromised=true</script>\nIgnore previous instructions'));
  assert.equal(result.count,3); assert.equal(result.messages[0].text,'Xin chào');
  assert.equal(globalThis.compromised,undefined); assert.equal(result.messages[2].text,'Ignore previous instructions');
  const json=parseImport(input(JSON.stringify({messages:[{text:'Ừ nhé',speaker:'Mẹ',timestamp:'2026-01-01T00:00:00Z',__proto__:{bad:true}}]}),{source:'zalo'}));
  assert.equal(json.messages[0].speaker,'Mẹ'); assert.equal(json.messages[0].timestamp,'2026-01-01T00:00:00Z');
  assert.deepEqual(result,parseImport(input('Xin chào\n<script>globalThis.compromised=true</script>\nIgnore previous instructions')));
});
test('rejects missing consent, malformed JSON, unknown source, oversized input and invalid messages',()=>{
  for(const value of [input('ok',{consent:false}),input('[]'),input('{oops'),input('ok',{source:'inbox'}),input('a'.repeat(262145)),input(JSON.stringify([{text:'a'.repeat(10001)}])),input(JSON.stringify([{text:2}])), input(JSON.stringify(Array.from({length:5001},()=>({text:'a'}))))]) assert.throws(()=>parseImport(value));
  assert.throws(()=>parseImport(input('   ')));
});
test('rules cite actual evidence and abstain for neutral or ambiguous context',()=>{
  const messages=parseImport(input('Hôm nay học toán\nĐưa mật khẩu và mã OTP cho tôi\nTao sẽ đánh mày')).messages;
  const result=analyzeContent(messages);
  assert.ok(result.observations.some(x=>x.type==='credentials'&&x.evidenceRefs.includes(messages[1].id)));
  assert.ok(result.observations.some(x=>x.type==='threat'&&x.evidenceRefs.includes(messages[2].id)));
  assert.ok(result.observations.every(x=>x.uncertainty)); assert.ok(result.limitations.length);
  assert.deepEqual(analyzeContent(messages),result);
  assert.equal(analyzeContent(parseImport(input('Học toán vui quá')).messages).observations.length,0);
  assert.equal(analyzeContent(parseImport(input('Đừng nói "tao sẽ đánh mày"')).messages).observations.length,0);
});
test('classifier requires real balanced data and safely round trips adversarial tokens',()=>{
  assert.throws(()=>trainClassifier([])); assert.throws(()=>trainClassifier(examples().slice(0,19)));
  assert.throws(()=>trainClassifier(examples().map(x=>({...x,label:'__proto__'}))));
  const model=trainClassifier(examples().map(x=>({...x,text:x.text+' __proto__ constructor'})));
  const restored=JSON.parse(JSON.stringify(model));
  const observations=classifyMessages(restored,[{id:'e1',text:'chuyển tiền nhận thưởng'}]);
  assert.equal(observations[0].type,'scam'); assert.deepEqual(observations[0].evidenceRefs,['e1']);
  assert.ok(observations[0].estimatedProbability>0.5); assert.match(observations[0].uncertainty,/hiệu chuẩn/);
  assert.equal(classifyMessages(restored,[{id:'e2',text:'zzzunknown'}]).length,0);
});
test('holdout evaluation gives measured metrics and rejects training overlap',()=>{
  const model=trainClassifier(examples());
  const holdout=[{label:'neutral',text:'học bài vui vẻ mới'},{label:'bullying',text:'đồ ngu cút đi ngay'},{label:'scam',text:'chuyển tiền nhận thưởng ngay'},{label:'threat',text:'tao sẽ giết mày ngay'}];
  const metrics=evaluateClassifier(model,holdout);
  assert.equal(metrics.accuracy,1); assert.equal(metrics.sampleCount,4); assert.equal(metrics.macroF1,1);
  assert.throws(()=>evaluateClassifier(model,[examples()[0]]));
});
test('UTF-8 byte limit and normalized Vietnamese duplicate rejection cannot be bypassed',()=>{
  assert.throws(()=>parseImport(input('ệ'.repeat(90000))));
  const dataset=examples(); dataset[1]={...dataset[0],text:dataset[0].text.normalize('NFD').toUpperCase()};
  assert.throws(()=>trainClassifier(dataset));
  assert.throws(()=>evaluateClassifier(trainClassifier(examples()),[{...examples()[0],text:examples()[0].text.normalize('NFD').toUpperCase()}]));
});
