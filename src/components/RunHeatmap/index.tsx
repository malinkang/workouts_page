import { useEffect, useMemo, useRef, useState } from 'react';
import CalHeatmap from 'cal-heatmap';
import CalendarLabel from 'cal-heatmap/plugins/CalendarLabel';
import Tooltip from 'cal-heatmap/plugins/Tooltip';
import { Activity, RunIds } from '@/utils/utils';
import styles from './style.module.scss';
import 'cal-heatmap/cal-heatmap.css';

interface RunHeatmapProps {
  runs: Activity[];
  year: string;
  locateActivity: (_runIds: RunIds) => void;
  setRunIndex: (_index: number) => void;
}

interface DaySummary {
  date: number;
  fillColor: string;
}

interface DayActivityBreakdown {
  label: string;
  distanceKm: number;
}

interface DayBucket {
  runIds: number[];
  totalDistanceKm: number;
  breakdown: Map<string, number>;
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_WEEK_COLUMNS = 53;

const getThemeMode = () =>
  (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

const formatUtcDateKey = (timestamp: number) => {
  const date = new Date(timestamp);
  const yearValue = date.getUTCFullYear();
  const monthValue = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dayValue = String(date.getUTCDate()).padStart(2, '0');
  return `${yearValue}-${monthValue}-${dayValue}`;
};

const dateKeyToUtcNoon = (dateKey: string) => {
  const [yearValue, monthValue, dayValue] = dateKey.split('-').map(Number);
  return Date.UTC(yearValue, monthValue - 1, dayValue, 12, 0, 0, 0);
};

const contributionColorsForTheme = (themeMode: 'light' | 'dark') => (
  themeMode === 'light'
    ? ['#9be9a8', '#40c463', '#30a14e', '#216e39']
    : ['#0e4429', '#006d32', '#26a641', '#39d353']
);

const emptyColorForTheme = (themeMode: 'light' | 'dark') => (themeMode === 'light' ? '#ebedf0' : '#161b22');

const fillColorForDistance = (distanceKm: number, thresholds: number[], colors: string[]) => {
  if (distanceKm <= 0) return colors[0];
  if (distanceKm <= thresholds[0]) return colors[1];
  if (distanceKm <= thresholds[1]) return colors[2];
  return colors[3];
};

const labelForActivityType = (type: string) => {
  switch (type) {
    case 'Ride':
    case 'VirtualRide':
    case 'EBikeRide':
      return '骑行';
    case 'Walk':
    case 'Hike':
      return '行走';
    case 'Swim':
    case 'WaterSport':
      return '游泳';
    case 'TrailRun':
    case 'Treadmill':
    case 'VirtualRun':
    case 'Run':
    default:
      return '跑步';
  }
};

const buildTooltipHtml = (dateKey: string, breakdown: DayActivityBreakdown[]) => {
  const lines = breakdown
    .filter((item) => item.distanceKm > 0)
    .map((item) => `${item.label} ${item.distanceKm.toFixed(1)} km`);

  return [dateKey, ...lines].join('<br />');
};

const getMonthLabelPositions = (
  displayYear: number,
  weekdayLabelWidth: number,
  cellSize: number,
  gutter: number,
  contentWidth: number,
) => {
  const januaryFirst = new Date(Date.UTC(displayYear, 0, 1, 12));
  const yearStart = new Date(Date.UTC(displayYear, 0, 1, 12));
  const labelPadding = 6;
  const positions: Array<{ label: string; left: number }> = [];

  MONTH_LABELS.forEach((label, monthIndex) => {
    const monthStart = new Date(Date.UTC(displayYear, monthIndex, 1, 12));
    const daysSinceYearStart = Math.floor(
      (monthStart.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000),
    );
    const columnIndex = Math.floor((januaryFirst.getUTCDay() + daysSinceYearStart) / 7);
    const rawLeft = weekdayLabelWidth + columnIndex * (cellSize + gutter);
    const estimatedLabelWidth = label.length * 6.4;
    const clampedLeft = Math.min(
      Math.max(Math.round(rawLeft), weekdayLabelWidth),
      Math.max(weekdayLabelWidth, Math.round(contentWidth - estimatedLabelWidth)),
    );

    const previous = positions[positions.length - 1];
    if (previous && clampedLeft - previous.left < estimatedLabelWidth + labelPadding) {
      return;
    }

    positions.push({ label, left: clampedLeft });
  });

  return positions;
};

const RunHeatmap = ({ runs, year, locateActivity, setRunIndex }: RunHeatmapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(getThemeMode);
  const [containerWidth, setContainerWidth] = useState(0);

  const {
    chartData,
    runsByDate,
    activeDays,
    bestDayKm,
    totalDistanceKm,
    totalColumns,
  } = useMemo(() => {
    const contributionColors = contributionColorsForTheme(themeMode);
    const emptyColor = emptyColorForTheme(themeMode);
    const byDate = new Map<string, DayBucket>();
    const displayYear = Number(year);

    for (const run of runs) {
      const dateKey = run.start_date_local.slice(0, 10);
      if (Number(dateKey.slice(0, 4)) !== displayYear) {
        continue;
      }

      const current = byDate.get(dateKey) || {
        runIds: [],
        totalDistanceKm: 0,
        breakdown: new Map<string, number>(),
      };
      const distanceKm = run.distance / 1000;
      const typeLabel = labelForActivityType(run.type);
      current.runIds.push(run.run_id);
      current.totalDistanceKm += distanceKm;
      current.breakdown.set(typeLabel, (current.breakdown.get(typeLabel) || 0) + distanceKm);
      byDate.set(dateKey, current);
    }

    let activeDayCount = 0;
    let bestDistance = 0;
    let totalDistance = 0;
    const nonZeroDistances: number[] = [];

    byDate.forEach((value) => {
      if (value.totalDistanceKm > 0) {
        activeDayCount += 1;
        totalDistance += value.totalDistanceKm;
        bestDistance = Math.max(bestDistance, value.totalDistanceKm);
        nonZeroDistances.push(value.totalDistanceKm);
      }
    });

    nonZeroDistances.sort((left, right) => left - right);
    const pickThreshold = (ratio: number) => {
      if (!nonZeroDistances.length) return 0;
      const index = Math.min(
        nonZeroDistances.length - 1,
        Math.floor((nonZeroDistances.length - 1) * ratio),
      );
      return nonZeroDistances[index];
    };

    const resolvedThresholds = [pickThreshold(0.25), pickThreshold(0.5), pickThreshold(0.75)];
    const chartEntries: DaySummary[] = [];

    byDate.forEach((value, date) => {
      chartEntries.push({
        date: dateKeyToUtcNoon(date),
        fillColor: fillColorForDistance(
          Number(value.totalDistanceKm.toFixed(2)),
          resolvedThresholds,
          [emptyColor, ...contributionColors],
        ),
      });
    });

    return {
      chartData: chartEntries,
      runsByDate: byDate,
      activeDays: activeDayCount,
      bestDayKm: bestDistance,
      totalDistanceKm: totalDistance,
      totalColumns: YEAR_WEEK_COLUMNS,
    };
  }, [runs, themeMode, year]);

  const layout = useMemo(() => {
    const gutter = 3;
    const weekdayLabelWidth = 28;
    const usableWidth = Math.max(containerWidth - weekdayLabelWidth, 0);
    const totalGaps = Math.max(totalColumns - 1, 0);
    const computedCell = totalColumns > 0
      ? Number(((usableWidth - gutter * totalGaps) / totalColumns).toFixed(2))
      : 10;
    const cellSize = Number(Math.max(computedCell, 6).toFixed(2));
    const contentWidth = weekdayLabelWidth + totalColumns * cellSize + totalGaps * gutter;

    return {
      gutter,
      cellSize,
      weekdayLabelWidth,
      contentWidth,
    };
  }, [containerWidth, totalColumns]);

  const monthLabelPositions = useMemo(
    () => getMonthLabelPositions(
      Number(year),
      layout.weekdayLabelWidth,
      layout.cellSize,
      layout.gutter,
      layout.contentWidth,
    ),
    [layout.cellSize, layout.contentWidth, layout.gutter, layout.weekdayLabelWidth, year],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setThemeMode(getThemeMode());
    });

    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;

    const updateWidth = () => {
      setContainerWidth(wrap.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;

    host.innerHTML = '';

    const heatmap = new CalHeatmap();
    const displayYear = Number(year);

    heatmap.on('click', (_event: PointerEvent, timestamp: number) => {
      const dateKey = formatUtcDateKey(timestamp);
      if (Number(dateKey.slice(0, 4)) !== Number(year)) return;

      const runIds = runsByDate.get(dateKey)?.runIds || [];
      if (!runIds.length) return;

      locateActivity(runIds);
      setRunIndex(-1);
    });

    void heatmap.paint(
      {
        itemSelector: host as unknown as string,
        range: 1,
        date: {
          start: new Date(Date.UTC(Number(year), 0, 1, 12, 0, 0, 0)),
          timezone: 'UTC',
        },
        domain: {
          type: 'year',
          gutter: 0,
          label: {
            text: null,
            position: 'top',
            textAlign: 'start',
            offset: { x: 0, y: 0 },
            height: 0,
          },
        },
        subDomain: {
          type: 'day',
          width: layout.cellSize,
          height: layout.cellSize,
          gutter: layout.gutter,
          radius: 2,
        },
        data: {
          source: chartData,
          x: 'date',
          y: 'fillColor',
          groupY: (values: Array<string | number | null>) => values[values.length - 1] ?? null,
          defaultValue: emptyColorForTheme(themeMode),
        },
        scale: {
          color: {
            type: 'ordinal',
            domain: [emptyColorForTheme(themeMode), ...contributionColorsForTheme(themeMode)],
            range: [emptyColorForTheme(themeMode), ...contributionColorsForTheme(themeMode)],
          },
        },
        animationDuration: 180,
        theme: themeMode,
      },
      [
        [Tooltip, {
          text: (timestamp: number) => {
            const dateKey = formatUtcDateKey(timestamp);
            if (Number(dateKey.slice(0, 4)) !== Number(year)) return '';

            const dayBucket = runsByDate.get(dateKey);
            if (!dayBucket) return '';

            const breakdown = Array.from(dayBucket.breakdown.entries())
              .map(([label, distanceKm]) => ({ label, distanceKm }))
              .sort((left, right) => right.distanceKm - left.distanceKm);
            return buildTooltipHtml(dateKey, breakdown);
          },
        }],
        [CalendarLabel, {
          position: 'left',
          width: layout.weekdayLabelWidth - 6,
          height: layout.cellSize,
          gutter: layout.gutter,
          padding: [0, 6, 0, 0],
          textAlign: 'end',
          text: () => WEEKDAY_LABELS,
        }],
      ],
    );

    return () => {
      heatmap.destroy();
      host.innerHTML = '';
    };
  }, [chartData, layout, locateActivity, runsByDate, setRunIndex, themeMode, year]);

  const legendColors = contributionColorsForTheme(themeMode);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>年度热力图</div>
          <div className={styles.subtitle}>{year} 年每日运动分布</div>
        </div>
        <div className={styles.summary}>
          <span>{activeDays} 天活跃</span>
          <span>累计 {totalDistanceKm.toFixed(0)} km</span>
          <span>最佳单日 {bestDayKm.toFixed(1)} km</span>
        </div>
      </div>

      <div ref={wrapRef} className={styles.heatmapWrap}>
        <div className={styles.monthLabels} style={{ width: layout.contentWidth }}>
          {monthLabelPositions.map((item) => (
            <span key={item.label} className={styles.monthLabel} style={{ left: item.left }}>
              {item.label}
            </span>
          ))}
        </div>
        <div
          ref={containerRef}
          className={styles.heatmapRoot}
          style={{ width: layout.contentWidth }}
        />
      </div>

      <div className={styles.legend}>
        <span>少</span>
        <div className={styles.legendCells}>
          <span className={styles.legendCellMuted} />
          {legendColors.map((color) => (
            <span key={color} className={styles.legendCell} style={{ backgroundColor: color }} />
          ))}
        </div>
        <span>多</span>
      </div>
    </div>
  );
};

export default RunHeatmap;
