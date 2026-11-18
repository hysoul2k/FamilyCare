// Local deterministic processing only. Imported text is never interpreted as code or instructions.
const LABELS = ['neutral', 'bullying', 'scam', 'threat'];
const MAX_BYTES = 256 * 1024;
const normalize = text => text.normalize('NFC').toLocaleLowerCase('vi').trim().replace(/\s+/gu, ' ');
const tokens = text => normalize(text).match(/[\p{L}\p{N}_]+/gu) || [];
const fail = message => { throw new Error(message); };
const byteSize = value => new TextEncoder().encode(value).length;

function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 5000) fail('Cần từ 1 đến 5000 tin nhắn.');
  return messages.map((message, index) => {
    if (!message || typeof message.text !== 'string' || !message.text.trim() || message.text.length > 10000) fail('Tin nhắn phải có văn bản, tối đa 10000 ký tự.');
    if (message.speaker !== undefined && (typeof message.speaker !== 'string' || message.speaker.length > 200)) fail('Tên người nói không hợp lệ.');
    if (message.timestamp !== undefined && (typeof message.timestamp !== 'string' || message.timestamp.length > 100 || !Number.isFinite(Date.parse(message.timestamp)))) fail('Thời gian không hợp lệ.');
    return { id: `m${index + 1}`, speaker: message.speaker?.trim() || 'Không rõ', text: message.text.trim(), ...(message.timestamp ? { timestamp: message.timestamp } : {}) };
  });
}

export function parseImport({ source, content, consent } = {}) {
  if (consent !== true) fail('Cần xác nhận quyền sử dụng nội dung trước khi nhập.');
  if (!['manual', 'zalo', 'facebook', 'instagram'].includes(source)) fail('Nguồn nhập không hợp lệ.');
  if (typeof content !== 'string' || byteSize(content) > MAX_BYTES || content.includes('\u0000') || content.includes('\uFFFD')) fail('Chỉ nhận văn bản UTF-8 hợp lệ tối đa 256 KB.');
  const text = content.replace(/^\uFEFF/u, '').trim();
  let data;
  if (/^[\[{]/u.test(text)) {
    try { data = JSON.parse(text); } catch { fail('JSON không hợp lệ.'); }
    data = Array.isArray(data) ? data : data?.messages;
  } else data = text.split(/\r?\n/u).filter(line => line.trim()).map(line => ({text: line}));
  const messages = validateMessages(data);
  return { messages, preview: messages.slice(0, 5), count: messages.length };
}

const RULES = [
  ['bullying', /(?:đồ ngu|cút đi|đồ vô dụng|nobody likes you|you are stupid)/u, 'Có cụm từ có thể mang tính xúc phạm hoặc bắt nạt.'],
  ['threat', /(?:tao sẽ (?:đánh|giết)|giết mày|i will (?:kill|hurt) you)/u, 'Có cụm từ đe dọa gây tổn hại; cần kiểm tra ngữ cảnh.'],
  ['scam', /(?:chuyển tiền|nhận thưởng|trúng thưởng|send money|guaranteed profit)/u, 'Có cụm từ liên quan yêu cầu tiền hoặc phần thưởng; chưa xác định lừa đảo.'],
  ['credentials', /(?:mật khẩu|mã otp|password|verification code)/u, 'Có đề cập thông tin xác thực; cần kiểm tra có yêu cầu tiết lộ hay không.'],
  ['contact', /(?:gửi (?:số điện thoại|địa chỉ)|gặp riêng|send (?:your address|phone number))/u, 'Có đề cập chia sẻ liên hệ hoặc gặp riêng; cần xem xét ngữ cảnh.'],
];
const UNCERTAINTY = 'Chỉ là dấu hiệu từ khóa; có thể là trích dẫn, phủ định, đùa hoặc thiếu ngữ cảnh. Cần người lớn xem lại.';
export function analyzeContent(messages) {
  validateMessages(messages);
  const observations = [];
  for (const [index, message] of messages.entries()) {
    const text = normalize(message.text);
    // Abstain for obvious negation/quotation markers rather than assigning intent.
    if (/(?:đừng|không nên|trích dẫn|ví dụ|do not|don't|quoted)/u.test(text)) continue;
    for (const [type, pattern, description] of RULES) if (pattern.test(text)) observations.push({type, description, evidenceRefs:[message.id || `m${index+1}`], uncertainty: UNCERTAINTY});
  }
  return {
    summary: `Đã rà soát ${messages.length} tin nhắn bằng quy tắc từ khóa; ${observations.length} dấu hiệu cần xem lại.`,
    observations, modelVersion:'rules-vi-en-1',
    limitations:['Không phải mô hình ngôn ngữ hay chẩn đoán tâm lý; không đánh giá tính cách.', 'Có thể bỏ sót tiếng lóng, mỉa mai, ngữ cảnh và ngôn ngữ khác; không có dấu hiệu không có nghĩa là an toàn.', 'Không tự động đọc hộp thư, khóa ứng dụng hoặc thực hiện hành động trên thiết bị.'],
  };
}

function validateSamples(samples) {
  if (!Array.isArray(samples) || !samples.length || samples.length > 5000) fail('Cần dữ liệu gán nhãn, tối đa 5000 mẫu.');
  const seen = new Set();
  for (const sample of samples) {
    if (!sample || !LABELS.includes(sample.label) || typeof sample.text !== 'string' || !tokens(sample.text).length || sample.text.length > 10000) fail('Mẫu huấn luyện không hợp lệ.');
    const key = normalize(sample.text);
    if (seen.has(key)) fail('Mẫu văn bản bị trùng.');
    seen.add(key);
  }
}

export function trainClassifier(samples) {
  validateSamples(samples);
  const counts = new Map(LABELS.map(label => [label, {documents:0,total:0,words:new Map()}]));
  const vocabulary = new Set();
  for (const sample of samples) {
    const group = counts.get(sample.label); group.documents++;
    for (const token of tokens(sample.text)) { vocabulary.add(token); group.total++; group.words.set(token,(group.words.get(token)||0)+1); }
  }
  if (samples.length < 20 || [...counts.values()].some(group => group.documents < 5)) fail('Cần ít nhất 20 mẫu, tối thiểu 5 mẫu cho mỗi nhãn neutral, bullying, scam, threat.');
  return {version:'multinomial-nb-vi-1', sampleCount:samples.length, vocabulary:[...vocabulary].sort(), classes:LABELS.map(label=>({label,documents:counts.get(label).documents,total:counts.get(label).total,words:[...counts.get(label).words.entries()].sort(([a],[b])=>a.localeCompare(b))})), trainingTexts:samples.map(sample=>normalize(sample.text))};
}

function predict(model, text) {
  if (!model || model.version !== 'multinomial-nb-vi-1' || !Array.isArray(model.classes) || model.classes.length !== 4 || !Array.isArray(model.vocabulary) || !model.vocabulary.length) fail('Mô hình không hợp lệ hoặc chưa được huấn luyện.');
  const vocabulary = new Set(model.vocabulary);
  const known = tokens(text).filter(token=>vocabulary.has(token));
  if (!known.length) return null;
  const scores = model.classes.map(group=>{
    if (!LABELS.includes(group.label) || !(group.documents>0) || !(group.total>0) || !Array.isArray(group.words)) fail('Mô hình không hợp lệ.');
    const words = new Map(group.words);
    const score = Math.log(group.documents/model.sampleCount) + known.reduce((sum,token)=>sum+Math.log(((words.get(token)||0)+1)/(group.total+vocabulary.size)),0);
    return {label:group.label,score};
  });
  const max = Math.max(...scores.map(item=>item.score));
  const denominator = scores.reduce((sum,item)=>sum+Math.exp(item.score-max),0);
  return scores.map(item=>({label:item.label,probability:Math.exp(item.score-max)/denominator})).sort((a,b)=>b.probability-a.probability)[0];
}

export function classifyMessages(model, messages) {
  validateMessages(messages);
  return messages.flatMap((message,index)=>{
    const prediction = predict(model,message.text);
    if (!prediction || prediction.label === 'neutral' || prediction.probability < 0.65) return [];
    return [{type:prediction.label, description:'Bộ phân loại cục bộ nhận thấy mẫu từ tương tự dữ liệu đã gán nhãn; cần kiểm tra nội dung gốc.', evidenceRefs:[message.id || `m${index+1}`], uncertainty:'Xác suất do bộ phân loại ước lượng, chưa được hiệu chuẩn; không phải xác suất trẻ gặp nguy hiểm.', estimatedProbability:prediction.probability, modelVersion:model.version}];
  });
}

export function evaluateClassifier(model, testSamples) {
  validateSamples(testSamples);
  const training = new Set(model?.trainingTexts || []);
  if (!training.size) fail('Thiếu thông tin để kiểm tra trùng dữ liệu huấn luyện.');
  if (testSamples.some(sample=>training.has(normalize(sample.text)))) fail('Dữ liệu kiểm thử trùng văn bản huấn luyện.');
  const confusionMatrix = LABELS.map(()=>LABELS.map(()=>0));
  let correct=0, abstained=0;
  for (const sample of testSamples) {
    const result=predict(model,sample.text);
    if (!result) {abstained++;continue;}
    confusionMatrix[LABELS.indexOf(sample.label)][LABELS.indexOf(result.label)]++;
    if (result.label === sample.label) correct++;
  }
  const perClass = LABELS.map((label,i)=>{
    const tp=confusionMatrix[i][i], predicted=confusionMatrix.reduce((sum,row)=>sum+row[i],0), actual=testSamples.filter(sample=>sample.label===label).length;
    const precision=predicted ? tp/predicted:0, recall=actual ? tp/actual:0;
    return {label,support:actual,precision,recall,f1:precision+recall ? 2*precision*recall/(precision+recall):0};
  });
  return {sampleCount:testSamples.length,accuracy:correct/testSamples.length,macroF1:perClass.reduce((sum,item)=>sum+item.f1,0)/4,abstained,labels:LABELS,confusionMatrix,perClass,limitations:'Chỉ đo trên tập kiểm thử do người dùng cung cấp; kiểm tra trùng văn bản không ngăn được rò rỉ cùng hội thoại hoặc diễn đạt lại. Tách theo hội thoại/người/nguồn trước khi huấn luyện.'};
}
