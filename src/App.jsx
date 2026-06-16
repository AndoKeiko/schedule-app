import { useMemo, useState } from 'react';
import EditView from './components/EditView';
import ListView from './components/ListView';
import { useSchedule } from './hooks/useSchedule';
import './App.css';

function App() {
  const { entries, dataPath, status, error, saveEntry, deleteEntry } = useSchedule();

  // selectedDate が空文字のときは新規作成モードです。
  // 一覧のカードをクリックすると、その日付が入り編集モードになります。
  const [selectedDate, setSelectedDate] = useState('');

  // 選択中の日付に対応する記録を一覧から探します。
  // useMemo は entries または selectedDate が変わったときだけ再計算します。
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.date === selectedDate) || null,
    [entries, selectedDate],
  );

  // 保存後は、その日付を選択状態にして「今保存した記録を編集中」にします。
  const handleSave = async (entry) => {
    await saveEntry(entry, selectedDate);
    setSelectedDate(entry.date);
  };

  // 新規ボタンでは選択を外し、EditView 側に空のフォームを表示させます。
  const handleNew = () => {
    setSelectedDate('');
  };

  // 削除後は選択中の記録がなくなるので、新規作成モードへ戻します。
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
