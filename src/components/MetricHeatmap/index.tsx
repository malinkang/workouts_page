import { useEffect, useMemo, useRef, useState } from 'react';
import CalHeatmap from 'cal-heatmap';
import CalendarLabel from 'cal-heatmap/plugins/CalendarLabel';
import Tooltip from 'cal-heatmap/plugins/Tooltip';
import styles from './style.module.scss';
import 'cal-heatmap/cal-heatmap.css';

export interface MetricRecord {
  date: string;
  value: number;
}

interface MetricHeatmapProps {
  title: string;
  unit: string;
  year: string;
  records: MetricRecord[];
  accent: string;
  decimals?: number;
}

const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', ''];
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const getThemeMode = (): 'light' | 'dark' => {
  if (typeof document !== 'undefined') {
    const documentTheme = document.documentElement.dataset.theme;
    if (documentTheme === 'light' || documentTheme === 'dark') return documentTheme;
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
};

const dateKeyToUtcNoon = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day, 12, 0, 0, 0);
};

const formatDate = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

const MetricHeatmap = ({ title, unit, year, records, accent, decimals = 0 }: MetricHeatmapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(getThemeMode);
  const displayYear = Number(year);
  const yearRecords = useMemo(
    () => records.filter((record) => record.date.slice(0, 4) === year && Number.isFinite(record.value)),
    [records, year],
  );
  const maxValue = useMemo(
    () => yearRecords.reduce((max, record) => Math.max(max, record.value), 0),
    [yearRecords],
  );
  const totalValue = useMemo(
    () => yearRecords.reduce((total, record) => total + record.value, 0),
    [yearRecords],
  );
  const chartData = useMemo(() => {
    const sorted = yearRecords.map((record) => record.value).sort((a, b) => a - b);
    const threshold = (ratio: number) => sorted.length
      ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))]
      : 0;
    const colors = ['#d9f7e1', '#a6e3b5', '#5bc77a', accent];
    const thresholds = [threshold(0.25), threshold(0.5), threshold(0.75)];
    return yearRecords.map((record) => {
      const color = record.value <= thresholds[0]
        ? colors[0]
        : record.value <= thresholds[1]
          ? colors[1]
          : record.value <= thresholds[2]
            ? colors[2]
            : colors[3];
      return { date: dateKeyToUtcNoon(record.date), value: record.value, fillColor: color };
    });
  }, [accent, yearRecords]);
  const layout = useMemo(() => {
    const columns = 53;
    const gutter = 3;
    const weekdayWidth = 24;
    const fallbackWidth = typeof window === 'undefined'
      ? 760
      : Math.min(Math.max(window.innerWidth - 40, 280), 828);
    const width = containerWidth || wrapRef.current?.clientWidth || fallbackWidth;
    const cellSize = Math.max((width - weekdayWidth - gutter * (columns - 1)) / columns, 6);
    return {
      gutter,
      cellSize: Number(cellSize.toFixed(2)),
      weekdayWidth,
      contentWidth: weekdayWidth + columns * cellSize + gutter * (columns - 1),
    };
  }, [containerWidth]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const observer = new MutationObserver(() => setThemeMode(getThemeMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => setContainerWidth(wrap.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;
    host.innerHTML = '';
    const heatmap = new CalHeatmap();
    const colors = ['#d9f7e1', '#a6e3b5', '#5bc77a', accent];

    const paint = heatmap.paint(
      {
        itemSelector: host as unknown as string,
        range: 1,
        date: { start: new Date(Date.UTC(displayYear, 0, 1, 12)), timezone: 'UTC' },
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
          defaultValue: themeMode === 'light' ? '#ebedf0' : '#21262d',
        },
        scale: {
          color: {
            type: 'ordinal',
            domain: [themeMode === 'light' ? '#ebedf0' : '#21262d', ...colors],
            range: [themeMode === 'light' ? '#ebedf0' : '#21262d', ...colors],
          },
        },
        animationDuration: 180,
        theme: themeMode,
      },
      [
        [Tooltip, {
          text: (timestamp: number) => {
            const date = formatDate(timestamp);
            const record = yearRecords.find((item) => item.date === date);
            return record
              ? `${date}<br />${record.value.toFixed(decimals)} ${unit}`
              : date;
          },
        }],
        [CalendarLabel, {
          position: 'left',
          width: layout.weekdayWidth - 4,
          height: layout.cellSize,
          gutter: layout.gutter,
          padding: [0, 4, 0, 0],
          textAlign: 'end',
          text: () => WEEKDAY_LABELS,
        }],
      ],
    );

    void paint.catch((error: unknown) => {
      // Keep paint failures visible during development instead of silently leaving an empty chart.
      console.error('[MetricHeatmap] Failed to paint heatmap', error);
    });
    return () => {
      void heatmap.destroy();
      host.innerHTML = '';
    };
  }, [accent, chartData, decimals, displayYear, layout, themeMode, unit, yearRecords]);

  const renderKey = `${year}-${themeMode}-${layout.cellSize}-${layout.contentWidth}`;

  return (
    <section className={styles.card} aria-label={`${title}热力图`}>
      <div className={styles.header}>
        <strong>{title}</strong>
        <span>{yearRecords.length} 天 · 合计 {totalValue.toLocaleString()} {unit}</span>
      </div>
      <div ref={wrapRef} className={styles.heatmapWrap}>
        <div className={styles.monthLabels} style={{ width: layout.contentWidth }}>
          {MONTH_LABELS.map((label, index) => (
            <span key={label} className={styles.monthLabel} style={{ left: layout.weekdayWidth + index * (layout.contentWidth - layout.weekdayWidth) / 12 }}>
              {label}
            </span>
          ))}
        </div>
        <div
          key={renderKey}
          ref={containerRef}
          className={styles.heatmapRoot}
          style={{ width: layout.contentWidth }}
        />
      </div>
      <div className={styles.legend}><span>少</span><span className={styles.legendScale} style={{ background: accent }} /><span>多</span><span className={styles.maxValue}>最高 {maxValue.toLocaleString()} {unit}</span></div>
    </section>
  );
};

export default MetricHeatmap;
