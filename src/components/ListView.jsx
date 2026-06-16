const conditionLabels = {
  good: '良い',
  normal: '普通',
  bad: '悪い',
};

// 保存済みの記録を一覧表示するコンポーネントです。
// カードをクリックすると App.jsx に選択した記録を渡し、編集画面へ反映します。
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
        // 一覧では全部を表示しすぎず、最初の3件だけを要約として見せます。
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
