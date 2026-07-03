/** OMR 카드 판독기 v32 - Apps Script Spreadsheet Backend
 * GitHub Pages OMR 앱에서 전송한 정답 템플릿과 학생 결과를 기존 스프레드시트에 저장합니다.
 * 기존 Apps Script 웹앱 방식에서 사용하던 시트 구조를 유지합니다.
 */

const OMR_TEMPLATE_PROP = 'OMR_TEMPLATE_V32_JSON';
const OMR_TEMPLATE_FALLBACK_PROPS = [
  'OMR_TEMPLATE_V31_JSON',
  'OMR_TEMPLATE_V30_JSON',
  'OMR_TEMPLATE_V29_JSON',
  'OMR_TEMPLATE_V28_JSON'
];

const SUBJECT_SHEETS = {
  '00': '국어(00)',
  '01': '수학(01)',
  '02': '사회(02)',
  '03': '과학(03)'
};

const SUBJECT_NAMES = {
  '00': '국어',
  '01': '수학',
  '02': '사회',
  '03': '과학'
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || '';
  const callback = p.callback || '';

  if (action === 'ping') {
    return respondJsonp_(callback, {
      ok: true,
      app: 'OMR Apps Script Backend',
      version: 'v32',
      spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
      time: new Date().toISOString()
    });
  }

  if (action === 'getTemplate') {
    return respondJsonp_(callback, getAnswerTemplate());
  }

  if (action === 'clearTemplate') {
    return respondJsonp_(callback, clearAnswerTemplate());
  }

  return HtmlService.createHtmlOutput(
    '<h2>OMR 카드 판독기 저장 백엔드</h2>' +
    '<p>이 주소는 GitHub Pages OMR 앱의 스프레드시트 저장용 Apps Script 웹앱 URL입니다.</p>' +
    '<p>GitHub Pages 앱의 설정 칸 또는 config.js에 이 웹앱 URL을 넣으세요.</p>'
  ).setTitle('OMR 저장 백엔드');
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || '';
    const payload = p.payload ? JSON.parse(p.payload) : {};

    if (action === 'saveTemplate') {
      return respondJson_(saveAnswerTemplate(payload));
    }
    if (action === 'saveResult') {
      return respondJson_(saveStudentResult(payload));
    }
    if (action === 'clearTemplate') {
      return respondJson_(clearAnswerTemplate());
    }
    return respondJson_({ ok: false, message: '알 수 없는 action입니다: ' + action });
  } catch (err) {
    return respondJson_({ ok: false, message: err && err.message ? err.message : String(err) });
  }
}

function respondJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function respondJsonp_(callback, obj) {
  const cb = String(callback || 'callback').replace(/[^A-Za-z0-9_.$]/g, '');
  return ContentService
    .createTextOutput(cb + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function saveAnswerTemplate(payload) {
  if (!payload) throw new Error('저장할 정답 데이터가 없습니다.');
  if (!payload.answers) throw new Error('정답 데이터가 없습니다.');
  if (!payload.template) throw new Error('구획 데이터가 없습니다.');
  if (!payload.objectivePoints) throw new Error('객관식 배점 데이터가 없습니다.');

  payload.version = 'v32';
  payload.savedAt = new Date().toISOString();
  PropertiesService.getDocumentProperties().setProperty(OMR_TEMPLATE_PROP, JSON.stringify(payload));
  return { ok: true, savedAt: payload.savedAt, property: OMR_TEMPLATE_PROP };
}

function getAnswerTemplate() {
  const props = PropertiesService.getDocumentProperties();
  const keys = [OMR_TEMPLATE_PROP].concat(OMR_TEMPLATE_FALLBACK_PROPS);
  for (let i = 0; i < keys.length; i++) {
    const raw = props.getProperty(keys[i]);
    if (raw) {
      return { ok: true, data: JSON.parse(raw), property: keys[i] };
    }
  }
  return { ok: false, message: '저장된 정답이 없습니다.' };
}

function clearAnswerTemplate() {
  const props = PropertiesService.getDocumentProperties();
  [OMR_TEMPLATE_PROP].concat(OMR_TEMPLATE_FALLBACK_PROPS).forEach(function(key) {
    props.deleteProperty(key);
  });
  return { ok: true, message: '저장된 정답을 삭제했습니다.' };
}

function saveStudentResult(payload) {
  if (!payload) throw new Error('저장할 학생 결과가 없습니다.');
  const classNo = Number(payload.classNo);
  const studentNo = Number(payload.studentNo);
  const subjectCode = normalizeSubjectCode_(payload.subjectCode);
  const score = Number(payload.finalScore);

  if (!classNo) throw new Error('반 정보가 없습니다.');
  if (!studentNo) throw new Error('번호 정보가 없습니다.');
  if (!SUBJECT_SHEETS[subjectCode]) throw new Error('지원하지 않는 과목코드입니다: ' + subjectCode);
  if (isNaN(score)) throw new Error('점수 정보가 올바르지 않습니다.');

  const saveResult = writeScoreToSheet_(subjectCode, classNo, studentNo, score);
  appendLog_(payload, saveResult);
  return { ok: true, saved: saveResult };
}

function writeScoreToSheet_(subjectCode, classNo, studentNo, score) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('활성 스프레드시트를 찾지 못했습니다. 이 Apps Script는 스프레드시트에 연결되어 있어야 합니다.');

  const sheetName = SUBJECT_SHEETS[subjectCode];
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) throw new Error(sheetName + ' 시트가 비어 있습니다.');

  const values = sheet.getRange(1, 1, lastRow, 4).getValues();
  let currentClass = null;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const parsedClass = parseClass_(row[0]);
    if (parsedClass !== null) currentClass = parsedClass;

    const parsedNo = parseStudentNo_(row[1]);
    if (parsedNo === null) continue;

    const rowClass = parsedClass !== null ? parsedClass : currentClass;
    if (rowClass === classNo && parsedNo === studentNo) {
      const rowNumber = i + 1;
      sheet.getRange(rowNumber, 4).setValue(score);
      return { sheetName: sheetName, row: rowNumber, cell: 'D' + rowNumber, score: score };
    }
  }

  throw new Error(sheetName + ' 시트에서 ' + classNo + '반 ' + studentNo + '번 행을 찾지 못했습니다.');
}

function appendLog_(payload, saveResult) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logName = 'OMR_판독로그';
  let sheet = ss.getSheetByName(logName);
  if (!sheet) {
    sheet = ss.insertSheet(logName);
    sheet.getRange(1, 1, 1, 19).setValues([[ 
      '시각','저장방식','과목코드','과목','반','번호','계열','결시','최종점수','객관식점수','서답형점수','객관식문항수','객관식만점','서답형만점','오답','미마킹','중복마킹','저장위치','답안'
    ]]);
    sheet.getRange(1, 1, 1, 19).setFontWeight('bold');
  }

  const subjectCode = normalizeSubjectCode_(payload.subjectCode);
  sheet.appendRow([
    new Date(),
    payload.client || 'github-pages-v32',
    subjectCode,
    SUBJECT_NAMES[subjectCode] || '',
    payload.classNo || '',
    payload.studentNo || '',
    payload.series === null || payload.series === undefined ? '' : payload.series,
    payload.absence ? '예' : '아니오',
    payload.finalScore,
    payload.objectiveScore,
    payload.shortScore,
    payload.objectiveCount || '',
    payload.objectiveMax || '',
    payload.shortMax || '',
    (payload.wrongQuestions || []).join(','),
    (payload.blankQuestions || []).join(','),
    (payload.multiQuestions || []).join(','),
    saveResult.sheetName + '!' + saveResult.cell,
    formatAnswersForLog_(payload.answers || {})
  ]);
}

function formatAnswersForLog_(answers) {
  const parts = [];
  Object.keys(answers).sort(function(a,b){return Number(a)-Number(b);}).forEach(function(q){
    const arr = answers[q] || [];
    parts.push(q + ':' + (arr.length ? arr.join('/') : '-'));
  });
  return parts.join(' ');
}

function parseClass_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value >= 1 && value <= 99 ? value : null;
  const text = String(value).trim();
  let m = text.match(/(\d+)\s*반/);
  if (m) return Number(m[1]);
  m = text.match(/^0*(\d{1,2})$/);
  if (m) return Number(m[1]);
  return null;
}

function parseStudentNo_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value >= 1 && value <= 99 ? value : null;
  const text = String(value).trim();
  const m = text.match(/0*(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 99 ? n : null;
}

function normalizeSubjectCode_(code) {
  const digits = String(code === null || code === undefined ? '' : code).replace(/[^0-9]/g, '');
  return digits ? digits.padStart(2, '0').slice(-2) : '';
}
