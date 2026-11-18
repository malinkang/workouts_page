import React, { useEffect, useMemo, useState } from 'react';
import { Activity } from '@/utils/utils';
import styles from './style.module.scss';

type DashboardMode = 'workout' | 'sleep';
type ActivityFilter = 'run' | 'walk' | 'ride' | 'other' | 'all';
type Period = 'day' | 'week' | 'month' | 'year' | 'total';

export interface SleepRecord {
  sleep_id: string;
  name: string;
  date: string;
  sleep_start: string;
  sleep_end: string;
  sleep_minutes: number;
  bed_minutes: number;
  deep_sleep_ratio?: number | null;
  light_sleep_ratio?: number | null;
  rem_sleep_ratio?: number | null;
  awake_count?: number | null;
  respiration_range?: string;
  source: string;
}

interface KeepStatsProps {
  activities: Activity[];
  sleepRecords: SleepRecord[];
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  onActivitySelectionChange: (activities: Activity[]) => void;
}

interface ActivityBucket {
  key: string;
  label: string;
  value: number;
  count: number;
  distance: number;
  duration: number;
  calories: number;
}

interface SleepBucket {
  key: string;
  label: string;
  value: number;
  count: number;
  sleepMinutes: number;
  bedMinutes: number;
}

const RUN_TYPES = new Set(['Run', 'Trail Run', 'Treadmill', 'VirtualRun']);
const WALK_TYPES = new Set(['Walk', 'Hike']);
const RIDE_TYPES = new Set(['Ride', 'Ninebot', 'VirtualRide', 'EBikeRide', 'Indoor Ride']);
const PERIOD_LABELS: Array<{ key: Period; label: string }> = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
  { key: 'total', label: '总计' },
];

const getDatePart = (value: string): string => value.replace('T', ' ').slice(0, 10);

const getIsoWeek = (value: string): string => {
  const [year, month, day] = getDatePart(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
};

const bucketForDate = (value: string, period: Period): { key: string; label: string } => {
  const date = getDatePart(value);
  if (period === 'day') return { key: date, label: date.slice(5) };
  if (period === 'month') return { key: date.slice(0, 7), label: date.slice(0, 7) };
  if (period === 'year') return { key: date.slice(0, 4), label: `${date.slice(0, 4)}年` };
  if (period === 'week') {
    const key = getIsoWeek(value);
    return { key, label: key.replace('-W', ' 第') + '周' };
  }
  return { key: 'total', label: '全部' };
};

const formatDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secondsPart = total % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}`;
};

const formatHours = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours}小时 ${String(remainder).padStart(2, '0')}分`;
};

const activityMatches = (activity: Activity, filter: ActivityFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'run') return RUN_TYPES.has(activity.type);
  if (filter === 'walk') return WALK_TYPES.has(activity.type);
  if (filter === 'ride') return RIDE_TYPES.has(activity.type);
  return !RUN_TYPES.has(activity.type) && !WALK_TYPES.has(activity.type) && !RIDE_TYPES.has(activity.type);
};

const KeepStats = ({
  activities,
  sleepRecords,
  mode,
  onModeChange,
  onActivitySelectionChange,
}: KeepStatsProps) => {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('run');
  const [period, setPeriod] = useState<Period>('year');
  const [selectedBucket, setSelectedBucket] = useState('total');

  const filteredActivities = useMemo(
    () => activities.filter((activity) => activityMatches(activity, activityFilter)),
    [activities, activityFilter],
  );

  const activityBuckets = useMemo<ActivityBucket[]>(() => {
    const byKey = new Map<string, ActivityBucket>();
    filteredActivities.forEach((activity) => {
      const bucket = bucketForDate(activity.start_date_local, period);
      const current = byKey.get(bucket.key) || {
        key: bucket.key,
        label: bucket.label,
        value: 0,
        count: 0,
        distance: 0,
        duration: 0,
        calories: 0,
      };
      current.count += 1;
      current.distance += activity.distance;
      current.duration += parseDuration(activity.moving_time);
      current.calories += activity.calories || 0;
      current.value = current.distance / 1000;
      byKey.set(bucket.key, current);
    });
    return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
  }, [filteredActivities, period]);

  const sleepBuckets = useMemo<SleepBucket[]>(() => {
    const byKey = new Map<string, SleepBucket>();
    sleepRecords.forEach((record) => {
      const bucket = bucketForDate(record.date, period);
      const current = byKey.get(bucket.key) || {
        key: bucket.key,
        label: bucket.label,
        value: 0,
        count: 0,
        sleepMinutes: 0,
        bedMinutes: 0,
      };
      current.count += 1;
      current.sleepMinutes += record.sleep_minutes;
      current.bedMinutes += record.bed_minutes;
      current.value = current.sleepMinutes / 60;
      byKey.set(bucket.key, current);
    });
    return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
  }, [period, sleepRecords]);

  const activeBuckets = mode === 'workout' ? activityBuckets : sleepBuckets;
  const activeBucketKeys = useMemo(() => new Set(activeBuckets.map((bucket) => bucket.key)), [activeBuckets]);

  useEffect(() => {
    if (!activeBucketKeys.has(selectedBucket)) {
      setSelectedBucket(activeBuckets[activeBuckets.length - 1]?.key || 'total');
    }
  }, [activeBucketKeys, activeBuckets, selectedBucket]);

  const selectedActivities = useMemo(() => {
    if (mode !== 'workout') return [];
    if (selectedBucket === 'total') return filteredActivities;
    return filteredActivities.filter(
      (activity) => bucketForDate(activity.start_date_local, period).key === selectedBucket,
    );
  }, [filteredActivities, mode, period, selectedBucket]);

  const selectedSleep = useMemo(() => {
    if (selectedBucket === 'total') return sleepRecords;
    return sleepRecords.filter((record) => bucketForDate(record.date, period).key === selectedBucket);
  }, [period, selectedBucket, sleepRecords]);

  useEffect(() => {
    onActivitySelectionChange(selectedActivities);
  }, [onActivitySelectionChange, selectedActivities]);

  const selectedActivitySummary = useMemo(() => {
    return selectedActivities.reduce(
      (summary, activity) => ({
        distance: summary.distance + activity.distance,
        duration: summary.duration + parseDuration(activity.moving_time),
        calories: summary.calories + (activity.calories || 0),
      }),
      { distance: 0, duration: 0, calories: 0 },
    );
  }, [selectedActivities]);

  const selectedSleepSummary = useMemo(
    () =>
      selectedSleep.reduce(
        (summary, record) => ({
          sleep: summary.sleep + record.sleep_minutes,
          bed: summary.bed + record.bed_minutes,
        }),
        { sleep: 0, bed: 0 },
      ),
    [selectedSleep],
  );

  const maxValue = Math.max(...activeBuckets.map((bucket) => bucket.value), 1);

  return (
    <section className={styles.panel} aria-label="运动和睡眠统计">
      <div className={styles.modeTabs} role="tablist" aria-label="记录类型">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'workout'}
          className={styles.modeTab}
          onClick={() => onModeChange('workout')}
        >
          运动记录
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'sleep'}
          className={styles.modeTab}
          onClick={() => onModeChange('sleep')}
        >
          睡眠
        </button>
      </div>

      {mode === 'workout' && (
        <div className={styles.activityTabs} role="tablist" aria-label="运动类型">
          {([
            ['run', '跑步'],
            ['walk', '步行'],
            ['ride', '骑行'],
            ['other', '其他'],
            ['all', '全部'],
          ] as Array<[ActivityFilter, string]>).map(([key, label]) => (
            <button
              type="button"
              role="tab"
              key={key}
              aria-selected={activityFilter === key}
              className={styles.activityTab}
              onClick={() => {
                setActivityFilter(key);
                setSelectedBucket('total');
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.periodTabs} role="tablist" aria-label="统计周期">
        {PERIOD_LABELS.map(({ key, label }) => (
          <button
            type="button"
            role="tab"
            key={key}
            aria-selected={period === key}
            className={styles.periodTab}
            onClick={() => {
              setPeriod(key);
              setSelectedBucket(key === 'total' ? 'total' : '');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.summaryHeader}>
        <div>
          <span className={styles.eyebrow}>{mode === 'workout' ? '当前选择' : '睡眠统计'}</span>
          <strong>{mode === 'workout' ? `${(selectedActivitySummary.distance / 1000).toFixed(2)} km` : formatHours(selectedSleepSummary.sleep)}</strong>
        </div>
        <span className={styles.selectionLabel}>
          {activeBuckets.find((bucket) => bucket.key === selectedBucket)?.label || '选择一个周期'}
        </span>
      </div>

      <div className={styles.metricGrid}>
        {mode === 'workout' ? (
          <>
            <div><span>完成</span><strong>{selectedActivities.length}</strong><small>次</small></div>
            <div><span>时长</span><strong>{formatDuration(selectedActivitySummary.duration)}</strong></div>
            <div><span>消耗</span><strong>{Math.round(selectedActivitySummary.calories).toLocaleString()}</strong><small>kcal</small></div>
          </>
        ) : (
          <>
            <div><span>睡眠</span><strong>{formatHours(selectedSleepSummary.sleep)}</strong></div>
            <div><span>卧床</span><strong>{formatHours(selectedSleepSummary.bed)}</strong></div>
            <div><span>记录</span><strong>{selectedSleep.length}</strong><small>晚</small></div>
          </>
        )}
      </div>

      <div className={styles.chartShell}>
        <div className={styles.chartHeader}>
          <span>{mode === 'workout' ? '里程（公里）' : '睡眠时长（小时）'}</span>
          <span>{activeBuckets.length} 个周期</span>
        </div>
        <div className={styles.chart} role="tablist" aria-label="周期数据">
          {activeBuckets.map((bucket) => (
            <button
              type="button"
              role="tab"
              aria-selected={selectedBucket === bucket.key}
              className={`${styles.barButton} ${selectedBucket === bucket.key ? styles.selectedBar : ''}`}
              key={bucket.key}
              onClick={() => setSelectedBucket(bucket.key)}
              title={`${bucket.label} ${bucket.value.toFixed(2)}`}
            >
              <span className={styles.barValue}>{bucket.value.toFixed(1)}</span>
              <span className={styles.barTrack}>
                <span className={styles.bar} style={{ height: `${Math.max((bucket.value / maxValue) * 100, 4)}%` }} />
              </span>
              <span className={styles.barLabel}>{bucket.label}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'sleep' && selectedSleep.length > 0 && (
        <div className={styles.sleepList}>
          {selectedSleep.slice().reverse().map((record) => (
            <div className={styles.sleepRow} key={record.sleep_id}>
              <div>
                <strong>{record.date}</strong>
                <span>{record.sleep_start ? `${record.sleep_start.slice(11, 16)} - ${record.sleep_end.slice(11, 16)}` : '时间未记录'}</span>
              </div>
              <strong>{formatHours(record.sleep_minutes)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const parseDuration = (value: string): number => {
  if (!value) return 0;
  const parts = value.split(', ');
  const time = parts[parts.length - 1].split(':').map(Number);
  const days = parts.length > 1 ? Number(parts[0].replace(' days', '')) : 0;
  if (time.length !== 3 || time.some(Number.isNaN)) return 0;
  return days * 86400 + time[0] * 3600 + time[1] * 60 + time[2];
};

export default KeepStats;
