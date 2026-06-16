const categories = ['仕事', '勉強', '家事', '運動', '休憩', '用事', 'その他'];

// 1つの作業行を入力するコンポーネントです。
// 親の EditView がデータ本体を持ち、このコンポーネントは変更内容を onChange で返します。
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
