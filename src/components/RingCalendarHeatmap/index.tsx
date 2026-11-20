import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { formatMinutesAsDuration } from '@/utils/utils';
import styles from './style.module.scss';

export interface ActivityRingRecord {
  ring_id?: string;
  date: string;
  move_actual: number;
  move_goal: number;
  exercise_actual: number;
  exercise_goal: number;
  stand_actual: number;
  stand_goal: number;
  notion_last_edited_time?: string | null;
}

interface RingCalendarHeatmapProps {
  records: ActivityRingRecord[];
}

type RingKey = 'move' | 'exercise' | 'stand';

interface RingMetric {
  key: RingKey;
  label: string;
  unit: string;
  color: string;
}

const RING_METRICS: RingMetric[] = [
  { key: 'move', label: '活动', unit: '千卡', color: '#fa114f' },
  { key: 'exercise', label: '锻炼', unit: '分钟', color: '#a8eb12' },
  { key: 'stand', label: '站立', unit: '小时', color: '#38c9e8' },
];

const MONTH_NAMES = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const numberFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
});

const formatRingMetricValue = (metric: RingMetric, value: number) =>
  metric.key === 'exercise'
    ? formatMinutesAsDuration(value)
    : `${numberFormatter.format(value)} ${metric.unit}`;

const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(
    2,
    '0'
  )}`;

const localTodayKey = () => {
  const today = new Date();
  return dateKey(today.getFullYear(), today.getMonth(), today.getDate());
};

const dateKeyToUtc = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const readableDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}年${month}月${day}日`;
};

const longestClosedStreak = (records: ActivityRingRecord[]) => {
  let longest = 0;
  let current = 0;
  let previous = Number.NaN;
  records.forEach((record) => {
    const value = dateKeyToUtc(record.date);
    current = value - previous === 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = value;
  });
  return longest;
};

const bestClosedMonth = (records: ActivityRingRecord[]) => {
  const counts = new Map<number, number>();
  records.forEach((record) => {
    const month = Number(record.date.slice(5, 7)) - 1;
    counts.set(month, (counts.get(month) || 0) + 1);
  });
  let bestMonth = -1;
  let bestCount = 0;
  counts.forEach((count, month) => {
    if (count > bestCount) {
      bestMonth = month;
      bestCount = count;
    }
  });
  return bestMonth >= 0 ? MONTH_NAMES[bestMonth] : '暂无';
};

const countUnclosedDays = (
  recordsByDate: Map<string, ActivityRingRecord>,
  year: number,
  coverageStart: string,
  today: string
) => {
  const start =
    coverageStart > `${year}-01-01` ? coverageStart : `${year}-01-01`;
  const end = today < `${year}-12-31` ? today : `${year}-12-31`;

  if (start > end) return 0;

  let count = 0;
  for (
    let value = dateKeyToUtc(start);
    value <= dateKeyToUtc(end);
    value += 86_400_000
  ) {
    const key = new Date(value).toISOString().slice(0, 10);
    if (!recordsByDate.has(key)) count += 1;
  }
  return count;
};

const RingGlyph = ({ record }: { record: ActivityRingRecord | null }) => {
  const radii: Record<RingKey, number> = {
    move: 8.2,
    exercise: 5.7,
    stand: 3.2,
  };
  const centers = { x: 11, y: 11 };

  return (
    <svg
      className={styles.ringGlyph}
      viewBox="0 0 22 22"
      aria-hidden="true"
      focusable="false"
    >
      {RING_METRICS.map((metric) => {
        const actual = record?.[`${metric.key}_actual` as const] || 0;
        const goal = record?.[`${metric.key}_goal` as const] || 1;
        const radius = radii[metric.key];
        const circumference = 2 * Math.PI * radius;
        const ratio = record ? Math.min(Math.max(actual / goal, 0), 1) : 0;

        return (
          <g key={metric.key}>
            <circle
              className={styles.ringTrack}
              cx={centers.x}
              cy={centers.y}
              r={radius}
            />
            {ratio > 0 && (
              <circle
                className={styles.ringProgress}
                cx={centers.x}
                cy={centers.y}
                r={radius}
                stroke={metric.color}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - ratio)}
                transform={`rotate(-90 ${centers.x} ${centers.y})`}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};

const MonthCalendar = ({
  year,
  month,
  recordsByDate,
  selectedDate,
  coverageStart,
  today,
  onSelect,
}: {
  year: number;
  month: number;
  recordsByDate: Map<string, ActivityRingRecord>;
  selectedDate?: string;
  coverageStart: string;
  today: string;
  onSelect: (_date: string) => void;
}) => {
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const closedCount = [...recordsByDate.keys()].filter(
    (date) =>
      Number(date.slice(0, 4)) === year &&
      Number(date.slice(5, 7)) - 1 === month
  ).length;
  const unclosedCount = Array.from({ length: daysInMonth }, (_, index) => {
    const value = dateKey(year, month, index + 1);
    return (
      value >= coverageStart && value <= today && !recordsByDate.has(value)
    );
  }).filter(Boolean).length;

  return (
    <article
      className={styles.monthCard}
      aria-label={`${year}年${MONTH_NAMES[month]}`}
    >
      <header className={styles.monthHeader}>
        <strong>{MONTH_NAMES[month]}</strong>
        <span>
          {closedCount || unclosedCount
            ? `${closedCount} 闭合 · ${unclosedCount} 未合`
            : '尚无数据'}
        </span>
      </header>
      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className={styles.daysGrid}>
        {Array.from({ length: firstWeekday }, (_, index) => (
          <span
            key={`leading-${index}`}
            className={styles.daySpacer}
            aria-hidden="true"
          />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const value = dateKey(year, month, day);
          const record = recordsByDate.get(value) || null;
          const isSelected = selectedDate === value;
          const isInCoverage = value >= coverageStart && value <= today;
          const isUnclosed = !record && isInCoverage;
          const isSelectable = Boolean(record) || isUnclosed;
          let label = `${readableDate(value)}，无圆环状态数据`;

          if (record) {
            label = `${readableDate(value)}，三环闭合。${RING_METRICS.map(
              (metric) =>
                `${metric.label} ${formatRingMetricValue(
                  metric,
                  record[`${metric.key}_actual` as const]
                )}`
            ).join('，')}`;
          } else if (isUnclosed) {
            label =
              value === today
                ? `${readableDate(value)}，今天的圆环尚未合上`
                : `${readableDate(value)}，三环未合上`;
          } else if (value > today) {
            label = `${readableDate(value)}，尚未到达`;
          } else if (value < coverageStart) {
            label = `${readableDate(value)}，早于圆环数据起始日期`;
          }

          return (
            <button
              type="button"
              key={value}
              className={`${styles.day} ${
                record
                  ? styles.closedDay
                  : isUnclosed
                  ? styles.unclosedDay
                  : styles.unavailableDay
              }`}
              disabled={!isSelectable}
              title={isSelectable ? label : undefined}
              aria-label={label}
              aria-pressed={isSelectable ? isSelected : undefined}
              aria-current={value === today ? 'date' : undefined}
              onClick={() => isSelectable && onSelect(value)}
            >
              <RingGlyph record={record} />
              {record && (
                <span className={styles.dayTooltip} aria-hidden="true">
                  <strong>{readableDate(value)} · 三环闭合</strong>
                  {RING_METRICS.map((metric) => (
                    <span key={metric.key}>
                      <i style={{ background: metric.color }} />
                      {metric.label}{' '}
                      {formatRingMetricValue(
                        metric,
                        record[`${metric.key}_actual` as const]
                      )}{' '}
                      /{' '}
                      {formatRingMetricValue(
                        metric,
                        record[`${metric.key}_goal` as const]
                      )}
                    </span>
                  ))}
                </span>
              )}
              {isUnclosed && (
                <span className={styles.dayTooltip} aria-hidden="true">
                  <strong>
                    {readableDate(value)} ·{' '}
                    {value === today ? '今天尚未合上' : '未合上'}
                  </strong>
                  <span>Notion 未保留该日三环的具体数值</span>
                </span>
              )}
            </button>
          );
        })}
        {Array.from(
          { length: Math.max(42 - firstWeekday - daysInMonth, 0) },
          (_, index) => (
            <span
              key={`trailing-${index}`}
              className={styles.daySpacer}
              aria-hidden="true"
            />
          )
        )}
      </div>
    </article>
  );
};

const RingDetail = ({
  record,
  selectedDate,
  today,
}: {
  record: ActivityRingRecord | null;
  selectedDate?: string;
  today: string;
}) => {
  if (!selectedDate) {
    return (
      <div className={styles.emptyDetail}>
        选择一个已经进入统计范围的日期，查看圆环状态。
      </div>
    );
  }

  if (!record) {
    const isToday = selectedDate === today;
    return (
      <div className={`${styles.detailCard} ${styles.unclosedDetailCard}`}>
        <div className={styles.detailHeading}>
          <span>选中日期</span>
          <time dateTime={selectedDate}>{readableDate(selectedDate)}</time>
          <strong className={styles.unclosedStatus}>
            {isToday ? '今天尚未合上' : '三环未合上'}
          </strong>
        </div>
        <div className={styles.unclosedDetailBody}>
          <div className={styles.unclosedPreview}>
            <RingGlyph record={null} />
          </div>
          <div>
            <strong>
              {isToday ? '今天仍在进行中' : 'Notion 没有这一天三环全闭合的记录'}
            </strong>
            <p>
              灰色空环表示未合上；该日的实际活动、锻炼和站立数值尚未进入静态数据。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailHeading}>
        <span>选中日期</span>
        <time dateTime={record.date}>{readableDate(record.date)}</time>
        <strong>三环闭合</strong>
      </div>
      <div className={styles.metricGrid}>
        {RING_METRICS.map((metric) => {
          const actual = record[`${metric.key}_actual` as const];
          const goal = record[`${metric.key}_goal` as const];
          const ratio = goal > 0 ? actual / goal : 0;
          return (
            <div
              key={metric.key}
              className={styles.metric}
              style={{ '--ring-color': metric.color } as CSSProperties}
            >
              <div className={styles.metricTitle}>
                <span className={styles.metricDot} />
                <span>{metric.label}</span>
                <strong>{Math.round(ratio * 100)}%</strong>
              </div>
              <progress
                value={actual}
                max={goal}
                aria-label={`${metric.label}完成度`}
              />
              <small>
                {formatRingMetricValue(metric, actual)} /{' '}
                {formatRingMetricValue(metric, goal)}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RingCalendarHeatmap = ({ records }: RingCalendarHeatmapProps) => {
  const today = useMemo(localTodayKey, []);
  const coverageStart = useMemo(
    () =>
      records.length
        ? records.reduce(
            (earliest, record) =>
              record.date < earliest ? record.date : earliest,
            records[0].date
          )
        : today,
    [records, today]
  );
  const years = useMemo(() => {
    const firstYear = Number(coverageStart.slice(0, 4));
    const currentYear = Number(today.slice(0, 4));
    const lastRecordYear = records.reduce(
      (latest, record) => Math.max(latest, Number(record.date.slice(0, 4))),
      currentYear
    );
    const lastYear = Math.max(currentYear, lastRecordYear);
    return Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => lastYear - index
    );
  }, [coverageStart, records, today]);
  const [year, setYear] = useState(() => years[0] || new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>();
  const yearTabsRef = useRef<HTMLDivElement>(null);

  const yearRecords = useMemo(
    () =>
      records
        .filter((record) => Number(record.date.slice(0, 4)) === year)
        .sort((left, right) => left.date.localeCompare(right.date)),
    [records, year]
  );
  const recordsByDate = useMemo(
    () => new Map(yearRecords.map((record) => [record.date, record])),
    [yearRecords]
  );
  const selectedRecord = selectedDate
    ? recordsByDate.get(selectedDate) || null
    : null;

  useEffect(() => {
    if (!years.includes(year)) {
      setYear(years[0] || new Date().getFullYear());
    }
  }, [year, years]);

  useEffect(() => {
    setSelectedDate(yearRecords[yearRecords.length - 1]?.date);
  }, [yearRecords]);

  useEffect(() => {
    const selected = yearTabsRef.current?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]'
    );
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [year]);

  const longestStreak = useMemo(
    () => longestClosedStreak(yearRecords),
    [yearRecords]
  );
  const bestMonth = useMemo(() => bestClosedMonth(yearRecords), [yearRecords]);
  const unclosedDays = useMemo(
    () => countUnclosedDays(recordsByDate, year, coverageStart, today),
    [coverageStart, recordsByDate, today, year]
  );

  return (
    <section className={styles.card} aria-labelledby="ring-calendar-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Apple Fitness</span>
          <h2 id="ring-calendar-title">活动圆环</h2>
          <p>三环全部达成后点亮；灰色空环表示该日未合上。</p>
        </div>
        <div
          ref={yearTabsRef}
          className={styles.yearTabs}
          aria-label="选择年份"
        >
          {years.map((item) => (
            <button
              key={item}
              type="button"
              className={styles.yearTab}
              aria-pressed={year === item}
              onClick={() => setYear(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>闭合天数</span>
          <strong>{yearRecords.length}</strong>
          <small>{year} 年</small>
        </div>
        <div className={styles.summaryCard}>
          <span>最长连续</span>
          <strong>{longestStreak}</strong>
          <small>连续全闭合</small>
        </div>
        <div className={styles.summaryCard}>
          <span>最佳月份</span>
          <strong>{bestMonth}</strong>
          <small>
            {bestMonth === '暂无'
              ? '等待记录'
              : `${
                  yearRecords.filter(
                    (record) =>
                      MONTH_NAMES[Number(record.date.slice(5, 7)) - 1] ===
                      bestMonth
                  ).length
                } 天闭合`}
          </small>
        </div>
        <div className={styles.summaryCard}>
          <span>未合上天数</span>
          <strong>{unclosedDays}</strong>
          <small>{year} 年截至今天</small>
        </div>
      </div>

      <RingDetail
        record={selectedRecord}
        selectedDate={selectedDate}
        today={today}
      />

      <div className={styles.legend} aria-label="圆环颜色说明">
        {RING_METRICS.map((metric) => (
          <span key={metric.key}>
            <i style={{ background: metric.color }} />
            {metric.label}
          </span>
        ))}
        <span>
          <i className={styles.unclosedLegend} />
          未合上
        </span>
        <span className={styles.legendNote}>未来日期不计入未合上</span>
      </div>

      <div className={styles.monthGrid}>
        {MONTH_NAMES.map((_, month) => (
          <MonthCalendar
            key={month}
            year={year}
            month={month}
            recordsByDate={recordsByDate}
            selectedDate={selectedDate}
            coverageStart={coverageStart}
            today={today}
            onSelect={setSelectedDate}
          />
        ))}
      </div>
    </section>
  );
};

export default RingCalendarHeatmap;
