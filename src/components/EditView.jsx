import { useEffect, useMemo, useState } from 'react';
import TaskRow from './TaskRow';

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 新しい作業行を作るための初期値です。
// id は React が行を見分けるために必要です。
const blankTask = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  time: '',
  name: '',
  category: '仕事',
  duration: '',
});

// 新規登録時に表示する、1日分の空データです。
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

  // 一覧で別の日付が選ばれたら、フォームの中身をその記録へ差し替えます。
  // selectedEntry が null の場合は新規入力フォームに戻します。
  useEffect(() => {
    setEntry(selectedEntry || blankEntry());
    setMessage('');
  }, [selectedEntry]);

  const hasSavedEntry = useMemo(() => Boolean(selectedEntry?.date), [selectedEntry]);

  // タスク行の入力が変わったとき、対象の1行だけを差し替えます。
  const updateTask = (taskId, nextTask) => {
    setEntry((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? nextTask : task)),
    }));
  };

  // 作業行を1つ追加します。
  const addTask = () => {
    setEntry((current) => ({
      ...current,
      tasks: [...current.tasks, blankTask()],
    }));
  };

  // 作業行を削除します。最後の1行だけは空行として残し、入力しやすくしています。
  const deleteTask = (taskId) => {
    setEntry((current) => ({
      ...current,
      tasks: current.tasks.length === 1
        ? [{ ...blankTask(), id: current.tasks[0].id }]
        : current.tasks.filter((task) => task.id !== taskId),
    }));
  };

  // 保存前に空の作業行を除き、日付を id としてそろえます。
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

  // 削除は取り消しにくい操作なので、Electron のネイティブダイアログで確認してから実行します。
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
