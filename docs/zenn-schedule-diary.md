---
title: "ElectronとReactで、ローカル完結のスケジュール日記アプリを作る"
emoji: "🗓️"
type: "tech"
topics: ["electron", "react", "vite", "json", "desktopapp"]
published: false
---

## はじめに

Electron と React を使って、デスクトップで動く「スケジュール日記」アプリを作ります。

このアプリでは、1日の作業、天気、体重、メモを入力して、日付ごとに JSON ファイルへ保存します。

作る機能は次の通りです。

- 1日の作業を入力する
- 日付ごとに保存する
- 一覧からクリックして編集する
- 新規登録する
- 削除する
- 天気と体重を記録する
- メモ欄に日記のような記録を残す
- JSON ファイルに保存する
- portable exe として配布する

Web サービスではなく、exe をダブルクリックして使うローカルアプリとして作ります。

## このアプリのねらい

このアプリの目的は、単にスケジュール管理ツールを作ることだけではありません。

小さなシステムを作りながら、画面、状態管理、ローカル保存、セキュリティ、exe 配布まで一通り学ぶことがねらいです。

特に意識したことは次の3つです。

- システムを作ることで学習する
- ローカルで完結させて、日記データを外部に送らない
- 毎日使えるくらい手軽にする

スケジュールや体重、日記メモは個人的な情報です。

そのため、今回はクラウドや外部 API には送らず、自分の PC の中だけで完結する構成にします。

## 完成イメージ

画面は大きく2つに分かれます。

- 左側: 保存済みの日付一覧
- 右側: 入力・編集フォーム

フォームでは、次の内容を入力できます。

- 日付
- 体調
- 天気
- 体重
- 作業一覧
- メモ

一覧のカードをクリックすると、その日の記録を編集できます。

## 使う技術

使う技術は次の通りです。

- Electron
- React
- Vite
- JSON ファイル保存
- electron-builder

React は画面を作るために使います。

Electron は React の画面をデスクトップアプリとして表示し、ローカルファイルへの保存も担当します。

Vite は開発中の画面表示とビルドに使います。

electron-builder は Windows 用の portable exe を作るために使います。

## Electron とは

Electron は、Web 技術でデスクトップアプリを作るための仕組みです。

通常、React や HTML、CSS、JavaScript で作った画面はブラウザ上で動きます。

Electron を使うと、その画面を Windows の exe アプリとして起動できます。

Electron には、ざっくり分けて2つの世界があります。

- main プロセス
  - アプリ本体側
  - ウィンドウ作成、ファイル保存、OS とのやり取りを担当する
- renderer プロセス
  - 画面側
  - React が動く場所

この2つの間をつなぐのが `preload.js` です。

今回の保存処理は、次のような流れになります。

```txt
React の画面
  ↓ 保存ボタンを押す
preload.js
  ↓ 許可した API だけを呼ぶ
main.js
  ↓
JSON ファイルに保存する
```

React 側から直接ファイルを触らず、Electron の main プロセスに保存処理を任せるのがポイントです。

## プロジェクトを作る

まず Vite で React プロジェクトを作ります。

```bash
npm create vite@latest schedule-app -- --template react
cd schedule-app
npm install
```

次に Electron 関連のパッケージを入れます。

```bash
npm install -D electron electron-builder concurrently wait-on cross-env
```

Windows の PowerShell で `npm` が止まる場合は、`npm.cmd` を使います。

```bash
npm.cmd install
```

## ファイル構成

最終的な構成は次のようにします。

```txt
schedule-app/
├─ main.js
├─ preload.js
├─ package.json
├─ vite.config.js
├─ index.html
├─ src/
│  ├─ main.jsx
│  ├─ App.jsx
│  ├─ App.css
│  ├─ index.css
│  ├─ hooks/
│  │  └─ useSchedule.js
│  └─ components/
│     ├─ EditView.jsx
│     ├─ ListView.jsx
│     └─ TaskRow.jsx
└─ docs/
   └─ zenn-schedule-diary.md
```

## package.json を設定する

`package.json` の `main` と `scripts`、`build` を設定します。

```json:package.json
{
  "name": "schedule-app",
  "private": true,
  "version": "0.1.0",
  "main": "main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "electron": "cross-env NODE_ENV=development electron .",
    "start": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && npm run electron\"",
    "dist": "vite build && electron-builder --win --x64"
  },
  "build": {
    "appId": "com.local.schedule-diary",
    "productName": "スケジュール日記",
    "win": {
      "target": "portable",
      "requestedExecutionLevel": "asInvoker"
    },
    "files": [
      "dist/**/*",
      "main.js",
      "preload.js",
      "package.json"
    ]
  }
}
```

`start` は開発用です。

Vite の開発サーバーを起動してから、Electron のウィンドウを開きます。

`dist` は配布用 exe を作るためのコマンドです。

## vite.config.js を設定する

Electron で Vite のビルド結果を読み込む場合は、`vite.config.js` に `base: './'` を指定します。

```js:vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
});
```

:::message
この設定は、配布版で画面が真っ白になる問題を防ぐために重要です。

Vite のデフォルト設定では、ビルド後の `index.html` から JavaScript や CSS を読むパスが `/assets/...` のような絶対パスになります。

ブラウザで Web サーバーから表示する場合はそれで動きますが、Electron の配布版では `win.loadFile()` でローカルの `dist/index.html` を読み込みます。

そのとき `/assets/...` のような絶対パスだと、アセットを正しく見つけられず、画面が真っ白になることがあります。

`base: './'` を指定すると、ビルド後のパスが `./assets/...` のような相対パスになります。

そのため、Electron の `loadFile()` でも JavaScript や CSS を正しく読み込めます。
:::

## main.js を作る

`main.js` は Electron の main プロセスです。

ウィンドウ作成、JSON の読み込み、保存、削除を担当します。

ここでは `import` ではなく `require` を使っています。

React 側のコードは Vite が ES Modules として扱うため `import` を使いますが、Electron の `main.js` は Node.js 側で CommonJS として実行する構成にしているためです。

このように、React 側と Electron の main プロセス側で書き方が少し違っていても問題ありません。

```js:main.js
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const DATA_FILE = 'schedule-data.json';
const MAX_ENTRY_COUNT = 5000;
const MAX_TEXT_LENGTH = 5000;
const MAX_TASK_COUNT = 80;

const dataPath = () => path.join(app.getPath('userData'), DATA_FILE);

function normalizeText(value, max = MAX_TEXT_LENGTH) {
  return String(value ?? '').slice(0, max);
}

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

function normalizeTask(task, index) {
  return {
    id: normalizeText(task?.id || `${Date.now()}-${index}`, 80),
    time: normalizeText(task?.time, 20),
    name: normalizeText(task?.name, 200),
    category: normalizeText(task?.category, 40),
    duration: normalizeText(task?.duration, 40),
  };
}

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

async function readStore() {
  try {
    const content = await fs.readFile(dataPath(), 'utf-8');
    return normalizeStore(JSON.parse(content));
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, entries: [] };
    return { version: 1, entries: [] };
  }
}

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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
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
```

ポイントは、React 側から来たデータをそのまま保存しないことです。

`normalizeEntry()` で日付、体調、天気、体重、メモ、作業行を保存しやすい形に整えています。

:::message
JSON の保存では、いきなり本番ファイルへ上書きせず、いったん `.tmp` ファイルへ書き込んでから `fs.rename()` で置き換えています。

こうしておくと、書き込み途中でアプリが落ちた場合でも、既存の JSON ファイルが壊れにくくなります。

日記や体重のように失いたくない個人データを扱う場合は、小さなローカルアプリでもこうした保存の工夫が効いてきます。
:::

また、保存時には `previousDate` も受け取っています。

これは、既存データを編集して日付を変更したときに、古い日付の記録が残らないようにするためです。

たとえば `2026-06-16` の記録を開いて、日付を `2026-06-17` に変更して保存した場合、古い `2026-06-16` は削除され、新しい `2026-06-17` として保存されます。

## preload.js を作る

`preload.js` は Electron と React の橋渡しです。

React 側に `ipcRenderer` を直接渡さず、必要な関数だけを公開します。

```js:preload.js
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  load: () => ipcRenderer.invoke('schedule:load'),
  saveEntry: (entry, previousDate) => ipcRenderer.invoke('schedule:save-entry', entry, previousDate),
  deleteEntry: (date) => ipcRenderer.invoke('schedule:delete-entry', date),
  getDataPath: () => ipcRenderer.invoke('schedule:get-data-path'),
  confirmDelete: (date) => ipcRenderer.invoke('schedule:confirm-delete', date),
};

contextBridge.exposeInMainWorld('scheduleApi', Object.freeze(api));
```

React 側では `window.scheduleApi.load()` のように呼べます。

## React 側のデータ操作をフックにまとめる

`src/hooks/useSchedule.js` を作ります。

JSON の読み込み、保存、削除をまとめるカスタムフックです。

```js:src/hooks/useSchedule.js
import { useCallback, useEffect, useMemo, useState } from 'react';

const emptyStore = { version: 1, entries: [] };

export function useSchedule() {
  const [store, setStore] = useState(emptyStore);
  const [dataPath, setDataPath] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setStatus('loading');
      const [nextStore, path] = await Promise.all([
        window.scheduleApi.load(),
        window.scheduleApi.getDataPath(),
      ]);
      setStore(nextStore);
      setDataPath(path);
      setError('');
      setStatus('ready');
    } catch (err) {
      setError(err?.message || 'データを読み込めませんでした');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveEntry = useCallback(async (entry, previousDate) => {
    const nextStore = await window.scheduleApi.saveEntry(entry, previousDate);
    setStore(nextStore);
    return nextStore;
  }, []);

  const deleteEntry = useCallback(async (date) => {
    const nextStore = await window.scheduleApi.deleteEntry(date);
    setStore(nextStore);
    return nextStore;
  }, []);

  const entries = useMemo(
    () => [...store.entries].sort((a, b) => b.date.localeCompare(a.date)),
    [store.entries],
  );

  return {
    entries,
    dataPath,
    status,
    error,
    reload,
    saveEntry,
    deleteEntry,
  };
}
```

画面コンポーネントから保存処理を分離することで、`App.jsx` が読みやすくなります。

## App.jsx で画面全体を組み立てる

`src/App.jsx` では、一覧と編集フォームを並べます。

`selectedDate` が空なら新規登録、日付が入っていれば編集モードです。

```jsx:src/App.jsx
import { useMemo, useState } from 'react';
import EditView from './components/EditView';
import ListView from './components/ListView';
import { useSchedule } from './hooks/useSchedule';
import './App.css';

function App() {
  const { entries, dataPath, status, error, saveEntry, deleteEntry } = useSchedule();
  const [selectedDate, setSelectedDate] = useState('');

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.date === selectedDate) || null,
    [entries, selectedDate],
  );

  const handleSave = async (entry) => {
    await saveEntry(entry, selectedDate);
    setSelectedDate(entry.date);
  };

  const handleNew = () => {
    setSelectedDate('');
  };

  const handleDelete = async (date) => {
    await deleteEntry(date);
    setSelectedDate('');
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local JSON Desktop App</p>
          <h1>スケジュール日記</h1>
        </div>
        <div className="header-stats">
          <span>{entries.length}日分</span>
          <span>{status === 'loading' ? '読み込み中' : '保存先あり'}</span>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-head">
            <h2>一覧</h2>
            <button type="button" className="small-btn" onClick={handleNew}>
              新規
            </button>
          </div>
          <ListView entries={entries} selectedDate={selectedDate} onSelect={(entry) => setSelectedDate(entry.date)} />
        </aside>

        <EditView
          key={selectedEntry?.date || 'new'}
          selectedEntry={selectedEntry}
          onSave={handleSave}
          onDelete={handleDelete}
          onNew={handleNew}
        />
      </section>

      <footer className="app-footer">
        <span>JSON保存先</span>
        <code>{dataPath || '確認中...'}</code>
      </footer>
    </main>
  );
}

export default App;
```

## 編集フォームを作る

`src/components/EditView.jsx` を作ります。

ここで、日付、体調、天気、体重、作業、メモを入力します。

```jsx:src/components/EditView.jsx
import { useEffect, useMemo, useState } from 'react';
import TaskRow from './TaskRow';

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const blankTask = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  time: '',
  name: '',
  category: '仕事',
  duration: '',
});

const blankEntry = () => ({
  id: today(),
  date: today(),
  condition: 'normal',
  weather: '',
  weight: '',
  memo: '',
  tasks: [blankTask()],
});

function EditView({ selectedEntry, onSave, onDelete, onNew }) {
  const [entry, setEntry] = useState(() => selectedEntry || blankEntry());
  const [message, setMessage] = useState('');

  useEffect(() => {
    setEntry(selectedEntry || blankEntry());
    setMessage('');
  }, [selectedEntry]);

  const hasSavedEntry = useMemo(() => Boolean(selectedEntry?.date), [selectedEntry]);

  const updateTask = (taskId, nextTask) => {
    setEntry((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? nextTask : task)),
    }));
  };

  const addTask = () => {
    setEntry((current) => ({
      ...current,
      tasks: [...current.tasks, blankTask()],
    }));
  };

  const deleteTask = (taskId) => {
    setEntry((current) => ({
      ...current,
      tasks: current.tasks.length === 1
        ? [{ ...blankTask(), id: current.tasks[0].id }]
        : current.tasks.filter((task) => task.id !== taskId),
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const cleaned = {
      ...entry,
      id: entry.date,
      weather: (entry.weather || '').trim(),
      weight: (entry.weight || '').trim(),
      tasks: entry.tasks
        .map((task) => ({
          ...task,
          name: task.name.trim(),
          duration: task.duration.trim(),
        }))
        .filter((task) => task.time || task.name || task.duration),
    };

    await onSave(cleaned);
    setMessage('保存しました');
  };

  const handleDelete = async () => {
    if (!hasSavedEntry) return;
    const ok = await window.scheduleApi.confirmDelete(entry.date);
    if (!ok) return;
    await onDelete(entry.date);
    onNew();
  };

  return (
    <form className="editor" onSubmit={handleSave}>
      <div className="editor-head">
        <div>
          <p className="eyebrow">{hasSavedEntry ? '編集' : '新規登録'}</p>
          <h2>{entry.date}</h2>
        </div>
        <div className="editor-actions">
          <button type="button" className="ghost-btn" onClick={onNew}>
            新規
          </button>
          <button type="submit" className="primary-btn">
            保存
          </button>
        </div>
      </div>

      <div className="field-grid">
        <label>
          日付
          <input
            type="date"
            value={entry.date}
            onChange={(event) => setEntry({ ...entry, date: event.target.value, id: event.target.value })}
            required
          />
        </label>
        <label>
          体調
          <select
            value={entry.condition}
            onChange={(event) => setEntry({ ...entry, condition: event.target.value })}
          >
            <option value="good">良い</option>
            <option value="normal">普通</option>
            <option value="bad">悪い</option>
          </select>
        </label>
        <label>
          天気
          <input
            type="text"
            value={entry.weather}
            onChange={(event) => setEntry({ ...entry, weather: event.target.value })}
            placeholder="晴れ、雨、くもりなど"
            maxLength={40}
          />
        </label>
        <label>
          体重
          <input
            type="text"
            value={entry.weight}
            onChange={(event) => setEntry({ ...entry, weight: event.target.value })}
            placeholder="例: 62.5kg"
            maxLength={20}
          />
        </label>
      </div>

      <div className="task-header">
        <span>時刻</span>
        <span>作業内容</span>
        <span>分類</span>
        <span>時間</span>
        <span />
      </div>

      <div className="task-list">
        {entry.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onChange={(nextTask) => updateTask(task.id, nextTask)}
            onDelete={() => deleteTask(task.id)}
          />
        ))}
      </div>

      <button type="button" className="add-btn" onClick={addTask}>
        + 作業を追加
      </button>

      <label className="memo-field">
        メモ
        <textarea
          value={entry.memo}
          onChange={(event) => setEntry({ ...entry, memo: event.target.value })}
          placeholder="今日の気づき、反省、明日やることなど"
          maxLength={5000}
        />
      </label>

      <div className="bottom-actions">
        <span className="save-message">{message}</span>
        {hasSavedEntry && (
          <button type="button" className="danger-btn" onClick={handleDelete}>
            削除
          </button>
        )}
      </div>
    </form>
  );
}

export default EditView;
```

`weather` と `weight` は、最初から保存データの一部として扱っています。

:::message
日付の初期値には `toISOString()` を使わず、ローカル時刻から `YYYY-MM-DD` を作っています。

`toISOString()` は UTC 基準の日付になるため、日本時間の夜に実行すると翌日の日付になってしまうことがあります。

日記アプリでは「今いる場所の今日」を使いたいので、`getFullYear()`、`getMonth()`、`getDate()` からローカル日付を作るようにしています。
:::

削除確認は `window.confirm()` ではなく、`preload.js` 経由で main プロセスの `dialog.showMessageBox()` を呼び出しています。

Electron のネイティブな確認ダイアログを使うことで、デスクトップアプリらしい挙動になります。

## 作業入力の1行を作る

`src/components/TaskRow.jsx` を作ります。

```jsx:src/components/TaskRow.jsx
const categories = ['仕事', '勉強', '家事', '運動', '休憩', '用事', 'その他'];

function TaskRow({ task, onChange, onDelete }) {
  return (
    <div className="task-row">
      <input
        className="inp-time"
        type="time"
        value={task.time}
        onChange={(event) => onChange({ ...task, time: event.target.value })}
        aria-label="開始時刻"
      />
      <input
        className="inp-task"
        type="text"
        value={task.name}
        onChange={(event) => onChange({ ...task, name: event.target.value })}
        placeholder="作業内容"
        maxLength={200}
        aria-label="作業内容"
      />
      <select
        className="inp-cat"
        value={task.category}
        onChange={(event) => onChange({ ...task, category: event.target.value })}
        aria-label="分類"
      >
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <input
        className="inp-dur"
        type="text"
        value={task.duration}
        onChange={(event) => onChange({ ...task, duration: event.target.value })}
        placeholder="1h"
        maxLength={40}
        aria-label="時間"
      />
      <button className="icon-btn danger" type="button" onClick={onDelete} aria-label="行を削除">
        X
      </button>
    </div>
  );
}

export default TaskRow;
```

## 一覧画面を作る

`src/components/ListView.jsx` を作ります。

一覧には、日付、体調、天気、体重、作業件数、作業内容の要約、メモの一部を表示します。

```jsx:src/components/ListView.jsx
const conditionLabels = {
  good: '良い',
  normal: '普通',
  bad: '悪い',
};

function ListView({ entries, selectedDate, onSelect }) {
  if (entries.length === 0) {
    return (
      <div className="empty">
        <strong>まだ記録がありません</strong>
        <span>右側のフォームから今日の作業を保存できます。</span>
      </div>
    );
  }

  return (
    <div className="entry-list">
      {entries.map((entry) => {
        const taskNames = entry.tasks
          .map((task) => task.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(' / ');
        const dailyMeta = [
          conditionLabels[entry.condition] || '普通',
          entry.weather,
          entry.weight,
          `${entry.tasks.length}件`,
        ].filter(Boolean);

        return (
          <button
            key={entry.date}
            className={`entry-card ${selectedDate === entry.date ? 'active' : ''}`}
            type="button"
            onClick={() => onSelect(entry)}
          >
            <span className="entry-date">{entry.date}</span>
            <span className="entry-meta">{dailyMeta.join('・')}</span>
            <span className="entry-title">{taskNames || '作業未入力'}</span>
            {entry.memo && <span className="entry-memo">{entry.memo}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default ListView;
```

`dailyMeta` で体調、天気、体重、作業件数をまとめています。

空欄の項目は `filter(Boolean)` で表示しないようにしています。

## CSS を整える

`src/App.css` で画面全体を整えます。

細かいデザインは自由ですが、今回は左に一覧、右に入力フォームを置く構成にします。

```css:src/App.css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #f7f7f2;
  color: #22252a;
  font-family: "Segoe UI", "Yu Gothic UI", Meiryo, sans-serif;
  font-size: 14px;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 24px;
  background: #20242a;
  color: #ffffff;
}

.eyebrow {
  margin: 0 0 4px;
  color: #7d8b6f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.app-header .eyebrow {
  color: #c9d6ad;
}

h1,
h2 {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  font-size: 24px;
  line-height: 1.2;
}

h2 {
  font-size: 18px;
  line-height: 1.3;
}

.header-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.header-stats span {
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 6px;
  padding: 6px 10px;
  color: #eef2e6;
  white-space: nowrap;
}

.notice {
  margin: 12px 24px 0;
  border-radius: 6px;
  padding: 10px 12px;
}

.notice.error {
  background: #fff1f0;
  border: 1px solid #f2b8b5;
  color: #8f1d18;
}

.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  min-height: 0;
}

.sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #deded4;
  background: #efefe8;
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #deded4;
}

.small-btn,
.ghost-btn,
.primary-btn,
.danger-btn,
.add-btn,
.icon-btn {
  border-radius: 6px;
  border: 1px solid transparent;
  min-height: 34px;
}

.small-btn,
.ghost-btn {
  background: #ffffff;
  border-color: #d7d7cb;
  color: #30343a;
  padding: 7px 12px;
}

.primary-btn {
  background: #20242a;
  color: #ffffff;
  padding: 8px 18px;
}

.danger-btn {
  background: #fff4f2;
  border-color: #dfb4ac;
  color: #9a2b20;
  padding: 8px 14px;
}

.entry-list {
  min-height: 0;
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-card {
  width: 100%;
  display: grid;
  gap: 4px;
  text-align: left;
  border: 1px solid #deded4;
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
  color: #22252a;
}

.entry-card:hover,
.entry-card.active {
  border-color: #6d7c55;
  background: #fbfcf6;
}

.entry-date {
  font-weight: 700;
  font-size: 15px;
}

.entry-meta,
.entry-title,
.entry-memo {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-meta {
  color: #69705f;
  font-size: 12px;
}

.entry-title {
  color: #373b41;
}

.entry-memo {
  color: #747b84;
  font-size: 12px;
}

.empty {
  display: grid;
  gap: 6px;
  color: #747b84;
  padding: 28px 16px;
}

.empty strong {
  color: #373b41;
}

.editor {
  min-height: 0;
  overflow: auto;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-head,
.bottom-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 12px;
}

label {
  display: grid;
  gap: 6px;
  color: #626a73;
  font-size: 12px;
  font-weight: 700;
}

.task-header,
.task-row {
  display: grid;
  grid-template-columns: 96px minmax(180px, 1fr) 112px 88px 38px;
  gap: 8px;
  align-items: center;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid #d7d7cb;
  border-radius: 6px;
  background: #ffffff;
  color: #22252a;
  padding: 9px 10px;
  outline: none;
}

input:focus,
select:focus,
textarea:focus {
  border-color: #6d7c55;
  box-shadow: 0 0 0 3px rgba(109, 124, 85, 0.14);
}

.task-header {
  color: #747b84;
  font-size: 12px;
  font-weight: 700;
  padding: 0 4px;
}

.task-list {
  display: grid;
  gap: 8px;
}

.icon-btn {
  width: 38px;
  min-width: 38px;
  background: #ffffff;
  border-color: #d7d7cb;
  color: #777d86;
  font-weight: 700;
}

.icon-btn.danger:hover {
  border-color: #dfb4ac;
  color: #9a2b20;
}

.add-btn {
  width: 100%;
  border-style: dashed;
  border-color: #c9c9bb;
  color: #4f5f3f;
  background: transparent;
  padding: 9px 12px;
}

textarea {
  min-height: 150px;
  resize: vertical;
  line-height: 1.55;
}

.memo-field textarea {
  min-height: 150px;
  resize: vertical;
  line-height: 1.55;
}

.save-message {
  min-height: 20px;
  color: #4f5f3f;
  font-weight: 700;
}

.app-footer {
  display: flex;
  gap: 10px;
  align-items: center;
  border-top: 1px solid #deded4;
  padding: 8px 16px;
  background: #ffffff;
  color: #626a73;
  font-size: 12px;
}

.app-footer code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #22252a;
}

@media (max-width: 860px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .sidebar {
    max-height: 260px;
    border-right: 0;
    border-bottom: 1px solid #deded4;
  }

  .task-header {
    display: none;
  }

  .task-row {
    grid-template-columns: 1fr 1fr 38px;
  }

  .inp-task,
  .inp-cat {
    grid-column: span 2;
  }
}
```

## index.html を設定する

`index.html` のタイトルを変え、CSP も入れておきます。

```html:index.html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:5173 ws://localhost:5173;"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>スケジュール日記</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

:::message
開発中に Vite の HMR や開発サーバー由来のコードが CSP に引っかかる場合があります。

その場合は、開発時だけ `script-src` に `'unsafe-eval'` や `'unsafe-inline'` を一時的に許可する、または開発用と配布用で CSP を切り替える方法があります。

ただし、配布版では CSP をむやみに緩めないほうが安全です。この記事ではローカル日記アプリとしての安全性を優先し、本番寄りの制限を入れています。
:::

## JSON の保存場所

JSON は exe と同じフォルダではなく、Electron の `app.getPath("userData")` に保存します。

Windows では、おおむね次のような場所です。

```txt
C:\Users\ユーザー名\AppData\Roaming\schedule-app\schedule-data.json
```

保存される JSON は次のような形です。

```json:schedule-data.json
{
  "version": 1,
  "entries": [
    {
      "id": "2026-06-16",
      "date": "2026-06-16",
      "condition": "normal",
      "weather": "晴れ",
      "weight": "62.5kg",
      "memo": "今日は集中できた",
      "tasks": [
        {
          "id": "example",
          "time": "09:00",
          "name": "Reactの勉強",
          "category": "勉強",
          "duration": "1h"
        }
      ],
      "updatedAt": "2026-06-16T00:00:00.000Z"
    }
  ]
}
```

## セキュリティで意識したこと

Electron は便利ですが、設定を雑にすると画面側から Node.js の機能を直接使えてしまいます。

今回は次の設定を入れています。

```js
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
}
```

意図は次の通りです。

- `contextIsolation: true`
  - Electron 側と画面側の実行環境を分ける
- `nodeIntegration: false`
  - React 側から Node.js を直接使わせない
- `sandbox: true`
  - 画面側の権限を小さくする
- `webSecurity: true`
  - ブラウザとしての基本的な安全機能を有効にする
- `preload.js`
  - 必要な API だけを安全に公開する

また、`preload.js` では `ipcRenderer` そのものを公開していません。

公開するのは `load`、`saveEntry`、`deleteEntry`、`getDataPath` だけです。

## 開発中の注意点

`npm run start` を実行すると、Vite の開発サーバーも起動します。

そのため、ブラウザで `http://localhost:5173/` を開くと React の画面だけは表示されます。

ただし、普通のブラウザでは Electron の `preload.js` が読み込まれません。

そのため、ブラウザ上では `window.scheduleApi` が存在せず、JSON 保存は動きません。

正しい動作確認は、Electron のウィンドウで行います。

配布版 exe では localhost は使いません。

`dist/index.html` を Electron のウィンドウ内で読み込むため、`preload.js` も使えます。

## 実行する

開発中は次のコマンドで起動します。

```bash
npm run start
```

PowerShell で `npm` が止まる場合は、次のようにします。

```bash
npm.cmd run start
```

ビルドだけ確認する場合は次のコマンドです。

```bash
npm run build
```

## portable exe を作る

配布用 exe を作る場合は次のコマンドです。

```bash
npm run dist
```

Windows の PowerShell では、必要に応じて次のように実行します。

```bash
npm.cmd run dist
```

成功すると、`dist` フォルダに exe が出力されます。

```txt
dist/
└─ スケジュール日記 0.1.0.exe
```

この exe をダブルクリックすると、Electron の中でアプリが起動します。

## ソースコードを共有するとき

ソースコードを共有する場合、`node_modules` と `dist` は含めなくて大丈夫です。

`node_modules` は依存パッケージ本体なので容量が大きく、`npm install` で復元できます。

`dist` はビルド結果なので、必要になったら `npm run dist` で再生成できます。

共有する主なファイルは次の通りです。

```txt
src/
public/
docs/
main.js
preload.js
index.html
package.json
package-lock.json
vite.config.js
eslint.config.js
README.md
```

コピー後は次のコマンドで依存関係を入れ直します。

```bash
npm install
```

## このアプリで学べること

この小さなアプリでも、学べることは多いです。

- React で入力フォームを作る
- 状態管理をコンポーネント間でつなぐ
- Electron でデスクトップアプリ化する
- IPC で画面側と main プロセスをつなぐ
- JSON ファイルにデータを保存する
- セキュリティを意識して API の公開範囲を絞る
- exe として配布する

特に、天気や体重のような項目を最初からデータ構造に入れておくと、あとから振り返り機能やグラフ機能を追加しやすくなります。

## 今後追加できそうな機能

今後追加するとよさそうな機能です。

- アプリアイコンを設定する
- 日付検索
- カテゴリ別の集計
- 体重の推移グラフ
- 天気ごとの作業量の振り返り
- JSON のバックアップ機能
- 月ごとのカレンダー表示
- CSV エクスポート

## まとめ

Electron と React を使って、ローカル完結のスケジュール日記アプリを作りました。

このアプリでは、作業内容、天気、体重、メモを日付ごとに JSON 保存できます。

クラウドに送らず、自分の PC の中だけで完結するので、個人的な作業記録や日記を残す用途に向いています。

小さなアプリでも、画面、保存、セキュリティ、配布まで一通り触れられます。

毎日使う小さな道具を自分で作ると、勉強した内容が実感として残りやすいです。
