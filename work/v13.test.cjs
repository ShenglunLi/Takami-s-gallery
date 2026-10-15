const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('memo/google_app_script/v13.js', 'utf8');
const sandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'GITHUB_TOKEN' ? 'test-token' : 'test-branch' }) },
  Utilities: {
    formatDate: value => value.toISOString().slice(0, 10),
    newBlob: value => ({ getDataAsString: () => Buffer.from(value).toString('utf8') }),
    base64Decode: value => Buffer.from(value, 'base64'),
    base64Encode: value => Buffer.from(value).toString('base64')
  }, Date, console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const config = vm.runInContext('CONFIG', sandbox);
const conf = name => ({ name, ...config[name] });
const plain = value => JSON.parse(JSON.stringify(value));
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function iterator(items) { let index = 0; return { hasNext: () => index < items.length, next: () => items[index++] }; }
function image(name) { return { getName: () => name }; }
function folder(name, filenames = [], children = []) {
  return { getName: () => name, getFiles: () => iterator(filenames.map(image)), getFolders: () => iterator(children) };
}
const diary = conf('diary_index');
const log = conf('log_index');
const gallery = conf('gallery_index');
const diaryRow = ['LFE-0016', 'single', '原標題', '第一段\n第二段', '2026-09-04', 'album/02.jpg', 'LIFE, GAME, LIFE'];
const inventory = sandbox.buildDriveInventory(folder('root', ['cover.jpg', 'notes.json'], [
  folder('album', ['01.jpg', '02.jpg', 'memo.txt'], [folder('nested', ['03.png'])]),
  folder('one', ['only.jpg']), folder('empty', ['notes.json'])
]), diary);

test('Diary 根目錄 single、單張資料夾 series、巢狀圖片及非圖片過濾', () => {
  assert.deepEqual(plain(inventory.map(group => [group.key, group.type, group.images])), [
    ['cover.jpg', 'single', ['cover.jpg']],
    ['album', 'series', ['album/01.jpg', 'album/02.jpg', 'album/nested/03.png']],
    ['one', 'series', ['one/only.jpg']]
  ]);
});
test('既有文章保留 ID、封面順序、內文，新增資料夾圖片不新增文章', () => {
  const rows = [diary.HEADERS, diaryRow];
  const before = JSON.stringify(rows);
  const plan = sandbox.planImageScan(rows, diary, inventory);
  assert.equal(plan.updates[0].type, 'series');
  assert.deepEqual(plain(plan.updates[0].images), ['album/02.jpg', 'album/01.jpg', 'album/nested/03.png']);
  assert.deepEqual(plain(plan.additions.map(item => item.row[0])), ['LFE-0017', 'LFE-0018']);
  assert.equal(JSON.stringify(rows), before);
});
test('重複掃描不新增列、不改圖片清單', () => {
  const plan = sandbox.planImageScan([diary.HEADERS, diaryRow], diary, inventory);
  const updated = diaryRow.slice(); updated[1] = 'series'; updated[5] = plan.updates[0].images.join(', ');
  const again = sandbox.planImageScan([diary.HEADERS, updated, ...plan.additions.map(item => item.row)], diary, inventory);
  assert.equal(again.additions.length, 0); assert.equal(again.updates.length, 0);
});
test('根目錄單圖的錯誤 type 自動修正', () => {
  const row = diaryRow.slice(); row[1] = 'series'; row[5] = 'cover.jpg';
  assert.equal(sandbox.planImageScan([diary.HEADERS, row], diary, inventory).updates[0].type, 'single');
});
test('多張根目錄圖片組成的人工文章保留一列', () => {
  const inv = sandbox.buildDriveInventory(folder('root', ['a.jpg', 'b.jpg']), diary);
  const row = diaryRow.slice(); row[5] = 'a.jpg, b.jpg';
  const plan = sandbox.planImageScan([diary.HEADERS, row], diary, inv);
  assert.equal(plan.additions.length, 0); assert.equal(plan.updates[0].type, 'series');
});
test('重複來源、重複 ID、同名 Drive 圖片會明確拒絕', () => {
  const other = diaryRow.slice(); other[0] = 'LFE-0017';
  assert.throws(() => sandbox.planImageScan([diary.HEADERS, diaryRow, other], diary, inventory), /對應到多列/);
  assert.throws(() => sandbox.planImageScan([diary.HEADERS, diaryRow, diaryRow], diary, inventory), /重複 ID/);
  assert.throws(() => sandbox.buildDriveInventory(folder('root', ['a.jpg', 'a.jpg']), diary), /重複圖片名稱/);
});
test('Diary JSON 多圖、首圖封面、換行、標籤去重與 type', () => {
  const row = diaryRow.slice(); row[1] = 'series'; row[5] = 'album/02.jpg, album/01.jpg';
  const data = sandbox.processData([diary.HEADERS, row], diary)[0];
  assert.deepEqual(plain(data.images), ['album/02.jpg', 'album/01.jpg']);
  assert.equal(data.img, 'album/02.jpg'); assert.equal(data.content, '第一段\n第二段');
  assert.deepEqual(plain(data.tags), ['LIFE', 'GAME']); assert.equal(data.tag, 'LIFE'); assert.equal(data.type, 'series');
});
test('Log JSON 保留南寮漁港、拒絕多圖與子路徑', () => {
  const row = ['LOG-0001', '2026-06-19', 'HSINCHU, TAIWAN', '南寮漁港', 'IMG_8699.jpg'];
  assert.equal(sandbox.processData([log.HEADERS, row], log)[0].location2, '南寮漁港');
  assert.throws(() => sandbox.processData([log.HEADERS, [...row.slice(0, 4), 'a.jpg,b.jpg']], log), /單張圖片/);
  assert.equal(sandbox.buildDriveInventory(folder('root', ['a.jpg'], [folder('sub', ['b.jpg'])]), log).length, 1);
});
test('Gallery series 格式與 order 排序相容', () => {
  const data = sandbox.processData([gallery.HEADERS,
    ['TKM-0001', 'series', '一', '', '2026-10-01', 'a/1.jpg,a/2.jpg', '短編漫画', '', '', '', 2],
    ['TKM-0002', 'single', '二', '', '2026-09-01', 'b.jpg', '落書き', '', '', '', 1]], gallery);
  assert.equal(data[0].id, 'TKM-0002'); assert.deepEqual(plain(data[1].img), ['a/1.jpg', 'a/2.jpg']);
});
test('空資料允許刪除最後一筆；日期、ID、路徑無效則拒絕', () => {
  assert.equal(sandbox.processData([diary.HEADERS], diary).length, 0);
  const row = diaryRow.slice(); row[4] = '2026-02-30';
  assert.throws(() => sandbox.processData([diary.HEADERS, row], diary), /日期/);
  row[4] = '2026-02-28'; row[0] = '';
  assert.throws(() => sandbox.processData([diary.HEADERS, row], diary), /ID/);
  assert.throws(() => sandbox.validateImagePath('../a.jpg'), /路徑無效/);
});
test('News 合併三類、日期排序取五筆、Log 支援 ID 連結', () => {
  const news = sandbox.buildNews({ gallery_index: Array.from({ length: 5 }, (_, i) => ({
    id: 'TKM-000' + i, date: '2026-09-0' + (i + 1), category: '落書き' })),
    diary_index: [{ id: 'LFE-0016', date: '2026-09-06' }],
    log_index: [{ id: 'LOG-0001', date: '2026-09-07', location2: '南寮漁港' }] });
  assert.equal(news.length, 5); assert.equal(news[0].url, 'log.html?id=LOG-0001');
  assert.equal(news[1].url, 'diary-entry.html?id=LFE-0016'); assert.equal(news[4].date, '2026-09-03');
});

function mockGitHub(store, failPatch = false) {
  const calls = [];
  sandbox.UrlFetchApp = { fetch: (url, options) => {
    const path = url.split('/Takami-s-gallery/')[1];
    const method = options.method;
    const body = options.payload && JSON.parse(options.payload);
    calls.push({ path, method, body });
    let status = 200, result;
    if (path === 'git/ref/heads/test-branch') result = { object: { sha: 'head0' } };
    else if (path.startsWith('contents/')) {
      const filename = decodeURIComponent(path.split('?')[0].slice(9));
      if (!(filename in store)) { status = 404; result = {}; }
      else result = { encoding: 'base64', content: Buffer.from(store[filename]).toString('base64'), sha: 'blob0' };
    } else if (path === 'git/commits/head0') result = { tree: { sha: 'tree0' } };
    else if (path === 'git/trees') result = { sha: 'tree1' };
    else if (path === 'git/commits') result = { sha: 'head1' };
    else if (path === 'git/refs/heads/test-branch') {
      if (failPatch) { status = 422; result = {}; } else result = { object: { sha: 'head1' } };
    } else throw new Error('Unexpected request: ' + path);
    return { getResponseCode: () => status, getContentText: () => JSON.stringify(result) };
  } };
  return calls;
}
const store = {
  'data/content.json': JSON.stringify([{ id: 'TKM-0001', date: '2026-09-01', title: '已發布' }]),
  'data/content_life.json': JSON.stringify([{ id: 'LFE-0001', date: '2026-09-02' }]),
  'data/log.json': JSON.stringify([{ id: 'LOG-0001', date: '2026-06-19', location2: '南寮漁港' }])
};
test('第一次 Diary 發布同一 commit 包含 diary、舊檔相容及 News；讀取固定快照', () => {
  const calls = mockGitHub(store);
  const data = sandbox.processData([diary.HEADERS, diaryRow], diary);
  sandbox.publishJsonAndNews(diary, data);
  const tree = calls.find(call => call.path === 'git/trees').body;
  assert.equal(tree.base_tree, 'tree0');
  assert.deepEqual(tree.tree.map(item => item.path), ['data/diary.json', 'data/news.json', 'data/content_life.json']);
  const patch = calls.find(call => call.method === 'patch');
  assert.equal(patch.body.force, false); assert.equal(patch.body.sha, 'head1');
  assert.ok(calls.filter(call => call.path.startsWith('contents/')).every(call => call.path.endsWith('?ref=head0')));
});
test('Gallery 發布前 Diary 新檔不存在時使用舊檔，缺少 Log 允許首次建立', () => {
  const initial = { ...store }; delete initial['data/log.json'];
  const calls = mockGitHub(initial);
  const result = sandbox.publishJsonAndNews(gallery, [{ id: 'TKM-0002', date: '2026-10-01' }]);
  assert.equal(result.news[1].id, 'LFE-0001');
  assert.ok(calls.some(call => call.path.startsWith('contents/data/content_life.json')));
});
test('無變動不建立 commit；並行推送衝突不強制覆寫', () => {
  const calls = mockGitHub(store);
  const data = sandbox.processData([diary.HEADERS, diaryRow], diary);
  sandbox.publishJsonAndNews(diary, data);
  const stable = { ...store };
  calls.find(call => call.path === 'git/trees').body.tree.forEach(file => { stable[file.path] = file.content; });
  const noop = mockGitHub(stable); assert.equal(sandbox.publishJsonAndNews(diary, data).updated, false);
  assert.equal(noop.filter(call => call.method !== 'get').length, 0);
  const conflict = mockGitHub(store, true);
  assert.throws(() => sandbox.publishJsonAndNews(diary, data), /HTTP 422/);
  assert.equal(conflict.filter(call => call.method === 'patch').length, 1);
});
test('HTTP 權限失敗不得被視為檔案不存在', () => {
  sandbox.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 403, getContentText: () => '{}' }) };
  assert.throws(() => sandbox.readGithubText('data/diary.json', 'head0', true), /HTTP 403/);
});
test('安全 JSON 預覽轉義 script 結束標籤', () => {
  const text = sandbox.serializeForInlineScript('</script> & \u2028');
  assert.ok(!text.includes('</script>')); assert.equal(JSON.parse(text), '</script> & \u2028');
});
test('Log 同時接受年月及完整日期，保留日期精度並依前端順序排序', () => {
  const data = sandbox.processData([log.HEADERS,
    ['LOG-0001', '2026-06', '', '', 'a.jpg'],
    ['LOG-0002', '2026-06-19', '', '', 'b.jpg'],
    ['LOG-0003', '2026-07', '', '', 'c.jpg']], log);
  assert.deepEqual(plain(data.map(item => item.date)), ['2026-07', '2026-06-19', '2026-06']);
});
test('僅年月限 Log；無效月份、日期及未補零格式拒絕同步', () => {
  ['2026-00', '2026-13', '2026-6', '2026', '2026-02-30'].forEach(date => {
    assert.throws(() => sandbox.processData([log.HEADERS, ['LOG-0001', date, '', '', 'a.jpg']], log), /日期/);
  });
  const row = diaryRow.slice(); row[4] = '2026-06';
  assert.throws(() => sandbox.processData([diary.HEADERS, row], diary), /日期/);
  assert.equal(sandbox.isValidEntryDate('2024-02-29', log), true);
  assert.equal(sandbox.isValidEntryDate('2026-02-29', log), false);
});
test('News 保留 Log 的年月，三類混合排序及其他分類發布皆可使用', () => {
  const news = sandbox.buildNews({
    log_index: [{ id: 'LOG-0001', date: '2026-07', location2: '南寮漁港' }],
    diary_index: [{ id: 'LFE-0001', date: '2026-06-30' }]
  });
  assert.equal(news[0].date, '2026-07'); assert.equal(news[0].url, 'log.html?id=LOG-0001');
  const monthlyStore = { ...store, 'data/log.json': JSON.stringify([{ id: 'LOG-0001', date: '2026-07' }]) };
  const calls = mockGitHub(monthlyStore);
  sandbox.publishJsonAndNews(gallery, [{ id: 'TKM-0002', date: '2026-06-30' }]);
  const tree = calls.find(call => call.path === 'git/trees').body.tree;
  const emittedNews = JSON.parse(tree.find(file => file.path === 'data/news.json').content);
  assert.equal(emittedNews.find(item => item.id === 'LOG-0001').date, '2026-07');
});
test('新增 Log 從檔名推得年月或日期，既有日期不因掃描改動', () => {
  const inv = sandbox.buildDriveInventory(folder('root', ['202604-P1.jpg', '20260419-P1.jpg']), log);
  const initial = [log.HEADERS, ['LOG-0001', '2025-12', '', '', '202604-P1.jpg']];
  const plan = sandbox.planImageScan(initial, log, inv);
  assert.equal(plan.updates.length, 0); assert.equal(initial[1][1], '2025-12');
  assert.equal(plan.additions[0].row[1], '2026-04-19');
  const allNew = sandbox.planImageScan([log.HEADERS], log, inv);
  assert.deepEqual(plain(allNew.additions.map(item => item.row[1])), ['2026-04', '2026-04-19']);
  assert.equal(sandbox.inferImageDate('202613-P1.jpg', log), '');
  assert.equal(sandbox.inferImageDate('20260230-P1.jpg', log), '');
  assert.equal(sandbox.inferImageDate('202604-P1.jpg', diary), '');
});
test('GAS Date 儲存格依顯示精度保留年月，完整日期仍保留日', () => {
  const dates = [new Date('2026-06-01T00:00:00Z'), new Date('2026-06-19T00:00:00Z')];
  const rows = [log.HEADERS, ['LOG-0001', dates[0], '', '', 'a.jpg'], ['LOG-0002', dates[1], '', '', 'b.jpg']];
  sandbox.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => ({
    getDataRange: () => ({ getValues: () => rows.map(row => row.slice()) }),
    getRange: (row, column, length, width) => {
      assert.deepEqual([row, column, length, width], [2, 2, 2, 1]);
      return { getDisplayValues: () => [['2026-06'], ['2026-06-19']] };
    }
  }) }) };
  const data = sandbox.processData(sandbox.readSheet(log).rows, log);
  assert.deepEqual(plain(data.map(item => item.date)), ['2026-06-19', '2026-06']);
});
test('Log 無法判斷年月的新增資料保留空白，不捏造照片日期', () => {
  const inv = sandbox.buildDriveInventory(folder('root', ['2026-P1.jpg', 'IMG_8699.jpg']), log);
  const plan = sandbox.planImageScan([log.HEADERS], log, inv);
  assert.deepEqual(plain(plan.additions.map(item => item.row[1])), ['', '']);
});
test('掃描新增 Log 列先設日期純文字，才寫入資料；保留既有日期', () => {
  const rows = [log.HEADERS, ['LOG-0001', '2025-12-19', '', '', 'old.jpg']];
  const events = [];
  const sheet = {
    getDataRange: () => ({ getValues: () => rows.map(row => row.slice()) }),
    getLastRow: () => rows.length, getMaxRows: () => 1000,
    getRange: (row, column, length, width) => ({
      getDisplayValues: () => [['2025-12-19']],
      setNumberFormat: format => { events.push(['format', row, column, length, width, format]); },
      setValues: values => { events.push(['values', row, column, plain(values)]); }
    })
  };
  sandbox.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }), flush: () => {} };
  sandbox.DriveApp = { getFolderById: () => folder('root', ['old.jpg', '202604-P1.jpg', '20260419-P2.jpg']) };
  assert.equal(sandbox.scanSheetImages(log).added, 2);
  assert.deepEqual(events[0], ['format', 3, 2, 2, 1, '@']);
  assert.equal(events[1][0], 'values');
  assert.deepEqual(events[1][3].map(row => row[1]), ['2026-04', '2026-04-19']);
  assert.equal(rows[1][1], '2025-12-19');
});
test('選取列日期工具僅修正指定列，保留未知月份、其他列與非日期內容', () => {
  const rows = [log.HEADERS,
    ['LOG-0001', '2026-04-01', 'TAIWAN', '地點', '202604-P1.jpg'],
    ['LOG-0002', '2026-10-14', '', '', '20260519-P1.jpg'],
    ['LOG-0003', '2025-08', '', '', '2026-P1.jpg'],
    ['LOG-0004', '2026-01-01', '', '', '202607-P1.jpg']];
  const original = JSON.stringify(rows);
  const events = [];
  const sheet = {
    getDataRange: () => ({ getValues: () => rows.map(row => row.slice()) }),
    getActiveRange: () => ({ getRow: () => 2, getNumRows: () => 3 }),
    getRange: (row, column) => {
      const range = {
        getDisplayValues: () => rows.slice(1).map(row => [row[1]]),
        setNumberFormat: format => { events.push(['format', row, column, format]); return range; },
        setValue: value => { events.push(['value', row, column, value]); return range; }
      };
      return range;
    }
  };
  sandbox.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }), flush: () => {} };
  sandbox.UrlFetchApp = { fetch: () => { throw new Error('不得呼叫 GitHub'); } };
  const message = sandbox.repairLogDatesInSelection(log);
  assert.deepEqual(events, [['format', 2, 2, '@'], ['value', 2, 2, '2026-04'],
    ['format', 3, 2, '@'], ['value', 3, 2, '2026-05-19']]);
  assert.match(message, /第 4 列/); assert.match(message, /尚未發布/);
  assert.equal(JSON.stringify(rows), original);
  assert.throws(() => sandbox.repairLogDatesInSelection(diary), /切換至 log_index/);
});
console.log(`${count} tests passed; no external requests or writes.`);
