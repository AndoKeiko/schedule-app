import { useCallback, useEffect, useMemo, useState } from 'react';

const emptyStore = { version: 1, entries: [] };

// JSON 保存まわりの処理を画面コンポーネントから切り離すためのカスタムフックです。
// App.jsx は「保存する」「削除する」といった操作だけを呼べばよくなります。
export function useSchedule() {
  const [store, setStore] = useState(emptyStore);
  const [dataPath, setDataPath] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  // アプリ起動時と再読み込み時に、Electron 側の API から JSON を読み込みます。
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

  // 初回表示時に一度だけ保存済みデータを読み込みます。
  useEffect(() => {
    reload();
  }, [reload]);

  // 1日分の記録を保存します。保存後は main.js から返ってきた最新データで画面を更新します。
  const saveEntry = useCallback(async (entry, previousDate) => {
    const nextStore = await window.scheduleApi.saveEntry(entry, previousDate);
    setStore(nextStore);
    return nextStore;
  }, []);

  // 指定した日付の記録を削除します。
  const deleteEntry = useCallback(async (date) => {
    const nextStore = await window.scheduleApi.deleteEntry(date);
    setStore(nextStore);
    return nextStore;
  }, []);

  // 一覧は新しい日付が上に来るように並べ替えてから返します。
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
