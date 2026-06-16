const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const DATA_FILE = 'schedule-data.json';
const MAX_ENTRY_COUNT = 5000;
const MAX_TEXT_LENGTH = 5000;
const MAX_TASK_COUNT = 80;

// app.getPath('userData') は OS が用意するアプリ専用の保存場所です。
// exe と同じフォルダへ書かないので、配布後も権限エラーが起きにくくなります。
const dataPath = () => path.join(app.getPath('userData'), DATA_FILE);

// 画面側から受け取った値を、そのまま JSON に保存しないための下処理です。
// 文字数を制限して、想定外に大きいデータが入るのを防ぎます。
function normalizeText(value, max = MAX_TEXT_LENGTH) {
  return String(value ?? '').slice(0, max);
}

// 日付は一覧のキーとして使うので、YYYY-MM-DD の形だけを許可します。
function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
}

function todayLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  const date = normalizeText(value, 10);
  return isDateString(date) ? date : todayLocal();
}

// 1行分の作業データを安全な形にそろえます。
function normalizeTask(task, index) {
  return {
    id: normalizeText(task?.id || `${Date.now()}-${index}`, 80),
    time: normalizeText(task?.time, 20),
    name: normalizeText(task?.name, 200),
    category: normalizeText(task?.category, 40),
    duration: normalizeText(task?.duration, 40),
  };
}

// 1日分の記録を保存用の形にそろえます。
// ここで体調、天気、体重、タスク数も安全な範囲にそろえています。
function normalizeEntry(entry) {
  const tasks = Array.isArray(entry?.tasks) ? entry.tasks.slice(0, MAX_TASK_COUNT) : [];
  const condition = ['good', 'normal', 'bad'].includes(entry?.condition) ? entry.condition : 'normal';

  return {
    id: normalizeDate(entry?.date),
    date: normalizeDate(entry?.date),
    condition,
    weather: normalizeText(entry?.weather, 40),
    weight: normalizeText(entry?.weight, 20),
    memo: normalizeText(entry?.memo),
    tasks: tasks.map(normalizeTask),
    updatedAt: normalizeText(entry?.updatedAt || new Date().toISOString(), 40),
  };
}

// 古い形式のデータにも少し対応できるよう、配列でもオブジェクトでも読み込めるようにしています。
// 同じ日付が複数あった場合は、最後に読んだものを採用します。
function normalizeStore(value) {
  const sourceEntries = Array.isArray(value?.entries)
    ? value.entries
    : Object.values(value || {});

  const byDate = new Map();
  for (const rawEntry of sourceEntries.slice(0, MAX_ENTRY_COUNT)) {
    const entry = normalizeEntry(rawEntry);
    byDate.set(entry.date, entry);
  }

  return {
    version: 1,
    entries: Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

// JSON ファイルを読み込みます。まだファイルがない初回起動では空の一覧を返します。
async function readStore() {
  try {
    const content = await fs.readFile(dataPath(), 'utf-8');
    return normalizeStore(JSON.parse(content));
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, entries: [] };
    return { version: 1, entries: [] };
  }
}

// JSON ファイルを書き込みます。
// いきなり本番ファイルへ書かず tmp に書いてから置き換えることで、
// 書き込み途中にアプリが落ちても壊れにくくしています。
async function writeStore(store) {
  const safeStore = normalizeStore(store);
  const filePath = dataPath();
  const tempPath = `${filePath}.tmp`;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, JSON.stringify(safeStore, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
  return safeStore;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f7f7f2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // React 側に Node.js の機能を直接渡さないための基本設定です。
      // ファイル操作は main.js だけが担当し、画面側は preload 経由の関数だけを使います。
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  if (process.env.NODE_ENV === 'development') {
    // 開発中は Vite の dev server を表示します。
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // 配布版ではビルド済みの HTML を表示します。
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // アプリ内で新しいウィンドウを勝手に開かせないための設定です。
  // 外部 URL が必要な場合だけ、既定ブラウザへ渡します。
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  // React 側から呼べる処理を IPC として登録します。
  // 画面側にはファイルパスや fs を直接触らせません。
  ipcMain.handle('schedule:load', async () => readStore());

  ipcMain.handle('schedule:save-entry', async (_event, entry, previousDate) => {
    const store = await readStore();
    const nextEntry = normalizeEntry({ ...entry, updatedAt: new Date().toISOString() });
    const oldDate = isDateString(previousDate) ? previousDate : null;
    const entries = store.entries.filter((item) => (
      item.date !== nextEntry.date && (!oldDate || item.date !== oldDate)
    ));
    entries.push(nextEntry);
    return writeStore({ version: 1, entries });
  });

  ipcMain.handle('schedule:delete-entry', async (_event, date) => {
    const safeDate = normalizeDate(date);
    const store = await readStore();
    return writeStore({
      version: 1,
      entries: store.entries.filter((entry) => entry.date !== safeDate),
    });
  });

  ipcMain.handle('schedule:get-data-path', async () => dataPath());

  ipcMain.handle('schedule:confirm-delete', async (event, date) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showMessageBox(parent, {
      type: 'warning',
      buttons: ['削除', 'キャンセル'],
      defaultId: 1,
      cancelId: 1,
      title: '記録の削除',
      message: `${normalizeDate(date)} の記録を削除しますか？`,
      detail: 'この操作は取り消せません。',
      noLink: true,
    });

    return result.response === 0;
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
