import styles from './style.module.scss';

export interface SleepOverviewRecord {
  sleep_id: string;
  date: string;
  sleep_start: string;
  sleep_end: string;
  sleep_minutes: number;
  bed_minutes: number;
  deep_sleep_ratio?: number | null;
  light_sleep_ratio?: number | null;
  rem_sleep_ratio?: number | null;
}

export interface SleepOverviewBucket {
  key: string;
  label: string;
  value: number;
  count: number;
}

type SleepPeriod = 'week' | 'month' | 'year' | 'total';

interface SleepOverviewProps {
  period: SleepPeriod;
  buckets: SleepOverviewBucket[];
  selectedBucket: string;
  selectedRecords: SleepOverviewRecord[];
  onSelectBucket: (_key: string) => void;
}

const formatHours = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours}小时 ${String(remainder).padStart(2, '0')}分`;
};

const average = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

const formatRange = (period: SleepPeriod, bucket: string) => {
  if (bucket === 'total') return '全部记录';
  if (period === 'week') {
    const [year, week] = bucket.split('-W');
    return `${year} 年第 ${Number(week)} 周`;
  }
  if (period === 'month') {
    const [year, month] = bucket.split('-');
    return `${year} 年 ${Number(month)} 月`;
  }
  return `${bucket} 年`;
};

const timePart = (value: string) => value?.slice(11, 16) || '--:--';

const SleepOverview = ({
  period,
  buckets,
  selectedBucket,
  selectedRecords,
  onSelectBucket,
}: SleepOverviewProps) => {
  const sleepMinutes = selectedRecords.map((record) => record.sleep_minutes).filter(Number.isFinite);
  const bedMinutes = selectedRecords.map((record) => record.bed_minutes).filter(Number.isFinite);
  const averageSleep = average(sleepMinutes);
  const averageBed = average(bedMinutes);
  const targetRate = sleepMinutes.length
    ? Math.round((sleepMinutes.filter((minutes) => minutes >= 420).length / sleepMinutes.length) * 100)
    : 0;
  const maxValue = Math.max(...buckets.map((bucket) => bucket.value), 1);

  const stageTotals = [
    { key: 'deep', label: '深睡', color: '#7466d8', value: average(selectedRecords.map((record) => record.deep_sleep_ratio || 0)) },
    { key: 'light', label: '浅睡', color: '#62a6e8', value: average(selectedRecords.map((record) => record.light_sleep_ratio || 0)) },
    { key: 'rem', label: 'REM', color: '#d27bd0', value: average(selectedRecords.map((record) => record.rem_sleep_ratio || 0)) },
  ];
  const stageTotal = stageTotals.reduce((sum, stage) => sum + stage.value, 0);
  const hasStageData = stageTotal > 0;

  return (
    <section className={styles.board} aria-label="睡眠概览">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>睡眠概览</p>
          <h2>让每一晚都更有节奏</h2>
          <p className={styles.description}>基于 Keep 睡眠记录，查看时长、作息窗口和睡眠结构。</p>
        </div>
        <div className={styles.rangePill} aria-label="当前睡眠统计范围">
          <span className={styles.rangeDot} aria-hidden />
          <span>{formatRange(period, selectedBucket)}</span>
        </div>
      </header>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon} aria-hidden>时</span>
          <span className={styles.summaryLabel}>平均睡眠</span>
          <strong>{formatHours(averageSleep)}</strong>
          <span className={styles.summaryHint}>{selectedRecords.length} 晚记录</span>
        </article>
        <article className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.summaryIconBlue}`} aria-hidden>床</span>
          <span className={styles.summaryLabel}>平均卧床</span>
          <strong>{formatHours(averageBed)}</strong>
          <span className={styles.summaryHint}>从入睡到起床</span>
        </article>
        <article className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.summaryIconGreen}`} aria-hidden>达</span>
          <span className={styles.summaryLabel}>7 小时达标</span>
          <strong>{targetRate}%</strong>
          <span className={styles.summaryHint}>记录达到目标时长</span>
        </article>
      </div>

      <div className={styles.contentGrid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <strong>睡眠时长</strong>
              <span>点击周期查看详情</span>
            </div>
            <span className={styles.cardMeta}>{buckets.length} 个周期</span>
          </div>
          <div className={styles.trendChart} role="tablist" aria-label="睡眠周期数据">
            {buckets.map((bucket) => {
              const height = Math.max((bucket.value / maxValue) * 150, 8);
              const selected = bucket.key === selectedBucket;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  key={bucket.key}
                  className={styles.trendItem}
                  onClick={() => onSelectBucket(bucket.key)}
                  title={`${bucket.label} ${bucket.value.toFixed(1)} 小时`}
                >
                  <span className={styles.trendValue}>{bucket.value.toFixed(1)}</span>
                  <span className={styles.trendTrack}>
                    <span className={styles.trendBar} style={{ height: `${height}px` }} />
                  </span>
                  <span className={styles.trendLabel}>{bucket.label}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <strong>睡眠结构</strong>
              <span>Keep 有记录的夜晚</span>
            </div>
            <span className={styles.cardMeta}>{hasStageData ? '平均占比' : '暂无阶段数据'}</span>
          </div>
          {hasStageData ? (
            <div className={styles.stageList}>
              {stageTotals.map((stage) => {
                const percentage = (stage.value / stageTotal) * 100;
                return (
                  <div className={styles.stageRow} key={stage.key}>
                    <div className={styles.stageLabel}>
                      <span className={styles.stageDot} style={{ backgroundColor: stage.color }} />
                      <span>{stage.label}</span>
                      <strong>{percentage.toFixed(0)}%</strong>
                    </div>
                    <div className={styles.stageTrack}>
                      <span style={{ width: `${percentage}%`, backgroundColor: stage.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyStage}>当前记录没有深睡、浅睡或 REM 阶段数据。</div>
          )}
        </article>
      </div>

      <article className={styles.recordsCard}>
        <div className={styles.cardHeader}>
          <div>
            <strong>最近记录</strong>
            <span>{formatRange(period, selectedBucket)}</span>
          </div>
          <span className={styles.cardMeta}>{selectedRecords.length} 晚</span>
        </div>
        <div className={styles.recordList}>
          {selectedRecords.slice().reverse().slice(0, 6).map((record) => (
            <div className={styles.recordRow} key={record.sleep_id}>
              <div>
                <strong>{record.date}</strong>
                <span>{timePart(record.sleep_start)} - {timePart(record.sleep_end)}</span>
              </div>
              <strong>{formatHours(record.sleep_minutes)}</strong>
            </div>
          ))}
          {!selectedRecords.length && <div className={styles.emptyStage}>这个周期还没有睡眠记录。</div>}
        </div>
      </article>
    </section>
  );
};

export default SleepOverview;
