import React, { useEffect, useMemo, useState } from 'react';
import { Activity } from '@/utils/utils';
import styles from './style.module.scss';

export type DashboardFilter = 'run' | 'walk' | 'ride' | 'sleep';
type ActivityFilter = Exclude<DashboardFilter, 'sleep'>;
type Period = 'week' | 'month' | 'year' | 'total';

export interface StatsSelection {
  period: Period;
  bucket: string;
  title: string;
}

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
  filter: DashboardFilter;
  onActivitySelectionChange: (activities: Activity[], selection: StatsSelection) => void;
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
  if (period === 'month') return { key: date.slice(0, 7), label: date.slice(0, 7) };
  if (period === 'year') return { key: date.slice(0, 4), label: `${date.slice(0, 4)}年` };
  if (period === 'week') {
    const key = getIsoWeek(value);
    return { key, label: key.replace('-W', ' 第') + '周' };
  }
  return { key: 'total', label: '全部' };
};

const titleForSelection = (period: Period, bucket: string): string => {
  if (period === 'total' || bucket === 'total') return '';
  if (period === 'year') return `${bucket}年`;
  if (period === 'month') {
    const [year, month] = bucket.split('-');
    return `${year}年${Number(month)}月`;
  }
  const [year, week] = bucket.split('-W');
  return `${year}年第${Number(week)}周`;
};

const formatHours = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours}小时 ${String(remainder).padStart(2, '0')}分`;
};

const activityMatches = (activity: Activity, filter: ActivityFilter): boolean => {
  if (filter === 'run') return RUN_TYPES.has(activity.type);
  if (filter === 'walk') return WALK_TYPES.has(activity.type);
  return RIDE_TYPES.has(activity.type);
};

const KeepStats = ({
  activities,
  sleepRecords,
  filter,
  onActivitySelectionChange,
}: KeepStatsProps) => {
  const [period, setPeriod] = useState<Period>('year');
  const [selectedBucket, setSelectedBucket] = useState('total');
  const mode = filter === 'sleep' ? 'sleep' : 'workout';

  const filteredActivities = useMemo(
    () =>
      filter === 'sleep'
        ? []
        : activities.filter((activity) => activityMatches(activity, filter)),
    [activities, filter],
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
  const effectiveBucket =
    selectedBucket === 'total' || activeBucketKeys.has(selectedBucket)
      ? selectedBucket
      : activeBuckets[activeBuckets.length - 1]?.key || 'total';

  useEffect(() => {
    if (!activeBucketKeys.has(selectedBucket)) {
      setSelectedBucket(activeBuckets[activeBuckets.length - 1]?.key || 'total');
    }
  }, [activeBucketKeys, activeBuckets, selectedBucket]);

  const selectedActivities = useMemo(() => {
    if (mode !== 'workout') return [];
    if (effectiveBucket === 'total') return filteredActivities;
    return filteredActivities.filter(
      (activity) => bucketForDate(activity.start_date_local, period).key === effectiveBucket,
    );
  }, [effectiveBucket, filteredActivities, mode, period]);

  const selectedSleep = useMemo(() => {
    if (effectiveBucket === 'total') return sleepRecords;
    return sleepRecords.filter((record) => bucketForDate(record.date, period).key === effectiveBucket);
  }, [effectiveBucket, period, sleepRecords]);

  useEffect(() => {
    onActivitySelectionChange(selectedActivities, {
      period,
      bucket: effectiveBucket,
      title: titleForSelection(period, effectiveBucket),
    });
  }, [effectiveBucket, onActivitySelectionChange, period, selectedActivities]);

  const maxValue = Math.max(...activeBuckets.map((bucket) => bucket.value), 1);

  return (
    <section className={styles.panel} aria-label="运动和睡眠统计">
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
              aria-selected={effectiveBucket === bucket.key}
              className={`${styles.barButton} ${effectiveBucket === bucket.key ? styles.selectedBar : ''}`}
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
