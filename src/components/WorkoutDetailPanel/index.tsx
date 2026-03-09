import React, { useMemo } from 'react';
import { Activity, ActivitySplit, formatRunTime, formatSpeedOrPace } from '@/utils/utils';
import styles from './style.module.scss';

interface WorkoutDetailPanelProps {
  run: Activity;
}

const formatSplitDuration = (durationSeconds?: number | null) => {
  if (!durationSeconds || durationSeconds <= 0) return '--:--';
  const total = Math.round(durationSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatSplitPace = (paceSeconds?: number | null) => {
  if (!paceSeconds || paceSeconds <= 0) return `--'--"`;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}'${String(seconds).padStart(2, '0')}"`;
};

const formatSplitHeartRate = (heartRate?: number | null) => {
  if (!heartRate || heartRate <= 0) return '--';
  return `${Math.round(heartRate)}`;
};

const formatSplitLabel = (split: ActivitySplit, index: number) => {
  if (split.index && split.index > 0) return `${split.index}K`;
  if (split.name) return split.name.replace(/\s+/g, '');
  return `${index + 1}K`;
};

const WorkoutDetailPanel = ({ run }: WorkoutDetailPanelProps) => {
  const metricItems = useMemo(() => {
    const primaryPace = run.average_speed ? formatSpeedOrPace(run.average_speed, run.type) : '--';

    return [
      { label: '里程', value: `${(run.distance / 1000).toFixed(2)}`, unit: 'km', accent: 'distance' },
      { label: '用时', value: formatRunTime(run.moving_time), unit: '', accent: 'default' },
      { label: run.type === 'Ride' ? '均速' : '配速', value: primaryPace, unit: '', accent: 'pace' },
      { label: '平均心率', value: run.average_heartrate ? `${Math.round(run.average_heartrate)}` : '--', unit: 'bpm', accent: 'heart' },
      { label: '最大心率', value: run.max_heartrate ? `${Math.round(run.max_heartrate)}` : '--', unit: 'bpm', accent: 'heart' },
      { label: '消耗热量', value: run.calories ? `${Math.round(run.calories)}` : '--', unit: 'kcal', accent: 'default' },
    ];
  }, [run]);

  const splitRows = useMemo(
    () => (run.splits || []).map((split, index) => ({
      key: split.notion_page_id || split.split_id || `${run.run_id}-${index}`,
      label: formatSplitLabel(split, index),
      duration: formatSplitDuration(split.duration),
      pace: formatSplitPace(split.average_pace),
      heartRate: formatSplitHeartRate(split.average_heartrate),
    })),
    [run],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.topGrid}>
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionTitle}>运动摘要</div>
              <div className={styles.sectionSubtitle}>{run.start_date_local.replace('T', ' ').slice(0, 16)}</div>
            </div>
            <div className={styles.runType}>{run.type}</div>
          </div>
          <div className={styles.runTitle}>{run.name || '未命名运动'}</div>
          {run.location_country && <div className={styles.runMeta}>{run.location_country}</div>}
          <div className={styles.metricsGrid}>
            {metricItems.map((item) => (
              <div key={item.label} className={styles.metricCard} data-accent={item.accent}>
                <span className={styles.metricLabel}>{item.label}</span>
                <span className={styles.metricValue}>
                  {item.value}
                  {item.unit && <small>{item.unit}</small>}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionTitle}>AI 运动点评</div>
              <div className={styles.sectionSubtitle}>预留给后续分析与建议</div>
            </div>
          </div>
          <div className={styles.insightList}>
            <div className={styles.insightItem}>完成后这里可以放一句总评，例如节奏是否稳定、强度是否合理。</div>
            <div className={styles.insightItem}>后续可追加配速波动、心率区间、恢复建议等内容。</div>
            <div className={styles.insightHint}>当前先保留卡位，避免以后为 AI 信息重新改布局。</div>
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionTitle}>分段表现</div>
            <div className={styles.sectionSubtitle}>{splitRows.length ? `共 ${splitRows.length} 段` : '暂无分段数据'}</div>
          </div>
        </div>
        {splitRows.length ? (
          <div className={styles.splitsTable}>
            <div className={styles.splitsHeader}>
              <span>分段</span>
              <span>时间</span>
              <span>配速</span>
              <span>心率</span>
            </div>
            <div className={styles.splitsBody}>
              {splitRows.map((split) => (
                <div key={split.key} className={styles.splitsRow}>
                  <span className={styles.splitLabel}>{split.label}</span>
                  <span className={styles.splitDuration}>{split.duration}</span>
                  <span className={styles.splitPace}>{split.pace}</span>
                  <span className={styles.splitHeartRate}>{split.heartRate}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>这条运动还没有分段数据，后续可以在这里展示 AI 节奏分析。</div>
        )}
      </section>
    </div>
  );
};

export default WorkoutDetailPanel;
