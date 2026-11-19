import { useCallback, useEffect, useState, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';
import KeepStats, {
  type DashboardFilter,
  type SleepRecord,
  type StatsSelection,
} from '@/components/KeepStats';
import RunMap from '@/components/RunMap';
import RunTable from '@/components/RunTable';
import useActivities from '@/hooks/useActivities';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import RunCalendar from '@/components/RunCalendar';
import RunHeatmap from '@/components/RunHeatmap';
import MetricHeatmap from '@/components/MetricHeatmap';
import {
  Activity,
  activityMatchesDashboardFilter,
  filterAndSortRuns,
  filterYearRuns,
  geoJsonForRuns,
  scrollToMap,
  sortDateFunc,
  titleForShow,
  RunIds,
} from '@/utils/utils';
import sleepRecords from '@/static/sleep_records.json';
import stepsRecords from '@/static/steps_records.json';
import waterRecords from '@/static/water_records.json';

const DASHBOARD_FILTERS: Array<{ key: DashboardFilter; label: string }> = [
  { key: 'run', label: '跑步' },
  { key: 'walk', label: '步行' },
  { key: 'ride', label: '电动车骑行' },
  { key: 'sleep', label: '睡眠' },
];

const Index = () => {
  useSiteMetadata();
  const { activities, thisYear } = useActivities();
  const [year, setYear] = useState(thisYear);
  const [runIndex, setRunIndex] = useState(-1);
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>('run');
  const [statsRuns, setStatsRuns] = useState<Activity[] | null>(null);
  const [statsTitle, setStatsTitle] = useState(`${thisYear}年`);
  const [runs, setActivity] = useState(
    filterAndSortRuns(activities, year, filterYearRuns, sortDateFunc)
  );
  // Keep the annual heatmap dataset separate from the currently selected period.
  const [heatmapYear, setHeatmapYear] = useState(thisYear);
  const [heatmapRuns, setHeatmapRuns] = useState(() =>
    filterAndSortRuns(activities, thisYear, filterYearRuns, sortDateFunc)
      .filter((activity) => activityMatchesDashboardFilter(activity, dashboardFilter))
  );
  
  const [title, setTitle] = useState('');
  const [geoData, setGeoData] = useState(geoJsonForRuns(runs));
  const dashboardMode = dashboardFilter === 'sleep' ? 'sleep' : 'workout';

  useEffect(() => {
    setHeatmapRuns(
      filterAndSortRuns(activities, heatmapYear, filterYearRuns, sortDateFunc)
        .filter((activity) => activityMatchesDashboardFilter(activity, dashboardFilter)),
    );
  }, [activities, dashboardFilter, heatmapYear]);

  const bentoRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (bentoRef.current) {
            const rect = bentoRef.current.getBoundingClientRect();
            const nextSticky = rect.bottom < 80;
            if (nextSticky !== isSticky) {
              setIsSticky(nextSticky);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isSticky]);

  const changeByItem = (
    item: string,
    name: string,
    func: (_run: Activity, _value: string) => boolean
  ) => {
    if (!isSticky) scrollToMap();
    setStatsRuns(null);
    if (name != 'Year') {
      setYear(thisYear);
    }
    setActivity(filterAndSortRuns(activities, item, func, sortDateFunc));
    setRunIndex(-1);
    setTitle(`${item} ${name} Heatmap`);
  };

  const changeYear = (y: string) => {
    setYear(y);
    if (y !== heatmapYear) {
      setHeatmapYear(y);
      setHeatmapRuns(
        filterAndSortRuns(activities, y, filterYearRuns, sortDateFunc)
          .filter((activity) => activityMatchesDashboardFilter(activity, dashboardFilter)),
      );
    }
    changeByItem(y, 'Year', filterYearRuns);
  };

  const selectActivityRuns = useCallback((runIds: RunIds, shouldScroll: boolean) => {
    const ids = new Set(runIds);
    const selectedRuns = !runIds.length
      ? runs
      : runs.filter((r: any) => ids.has(r.run_id));

    if (!selectedRuns.length) return;

    const lastRun = selectedRuns.reduce((acc: Activity, curr: Activity) =>
      sortDateFunc(acc, curr) <= 0 ? acc : curr
    );

    if (!lastRun) return;

    setGeoData(geoJsonForRuns(selectedRuns));
    setTitle(titleForShow(lastRun));
    if (shouldScroll && !isSticky) scrollToMap();
  }, [isSticky, runs]);

  const locateActivity = useCallback((runIds: RunIds) => {
    selectActivityRuns(runIds, true);
  }, [selectActivityRuns]);

  const locateActivityInline = useCallback((runIds: RunIds) => {
    selectActivityRuns(runIds, false);
  }, [selectActivityRuns]);

  useEffect(() => {
    setGeoData(geoJsonForRuns(runs));
  }, [runs]);

  const handleStatsSelection = useCallback((selectedActivities: Activity[], selection: StatsSelection) => {
    setStatsRuns(selectedActivities);
    setStatsTitle(selection.title || '');
    setRunIndex(-1);

    // A period selection carries its owning year. Keep the annual heatmap
    // stable for periods within that year and replace it only across years.
    const selectedYear = selectedActivities.length > 0 && selection.bucket !== 'total'
      ? selection.bucket.slice(0, 4)
      : undefined;
    if (selectedYear) {
      setYear(selectedYear);
      if (selectedYear !== heatmapYear) {
        setHeatmapYear(selectedYear);
        setHeatmapRuns(
          filterAndSortRuns(activities, selectedYear, filterYearRuns, sortDateFunc)
            .filter((activity) => activityMatchesDashboardFilter(activity, dashboardFilter)),
        );
      }
    }
  }, [activities, heatmapYear]);

  useEffect(() => {
    if (statsRuns === null) return;
    const nextRuns = [...statsRuns].sort(sortDateFunc);
    setActivity(nextRuns);
    setGeoData(geoJsonForRuns(nextRuns));
    setTitle(nextRuns.length ? titleForShow(nextRuns[nextRuns.length - 1]) : '');
  }, [statsRuns]);

  return (
    <Layout
      toolbarContent={
        <nav className="category-tabs" aria-label="内容筛选">
          {DASHBOARD_FILTERS.map(({ key, label }) => (
            <button
              type="button"
              className="category-tab"
              key={key}
              aria-pressed={dashboardFilter === key}
              onClick={() => setDashboardFilter(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      }
    >
      {dashboardMode === 'workout' && (
        <>
        <div className="bento-hero" ref={bentoRef}>
          <div className="bento-map-placeholder">
            <div className={`page-map bento-card-map ${isSticky ? 'sticky-map' : ''}`}>
              <RunMap
                title={title}
                geoData={geoData}
                changeYear={changeYear}
                thisYear={year}
                // 🌟 新增：把吸顶状态传给地图，让它知道什么时候该重新量尺寸
                isSticky={isSticky} 
              />
            </div>
          </div>

          <div className="bento-calendar-board">
            <RunCalendar
              runs={runs}
              locateActivity={locateActivity}
              runIndex={runIndex}
              setRunIndex={setRunIndex}
              year={year} 
                summaryTitle={statsTitle}
            />
          </div>
        </div>
        <div className="annual-heatmap-board">
          <RunHeatmap
            runs={heatmapRuns}
            locateActivity={locateActivity}
            setRunIndex={setRunIndex}
            year={heatmapYear}
          />
        </div>
        <div className="annual-heatmap-board metric-heatmap-grid">
          <MetricHeatmap
            title="步数热力图"
            unit="步"
            year={heatmapYear}
            records={stepsRecords.map((record) => ({ date: record.date, value: record.steps }))}
            accent="#22a861"
          />
          <MetricHeatmap
            title="饮水热力图"
            unit="ml"
            year={heatmapYear}
            records={waterRecords.map((record) => ({ date: record.date, value: record.water_ml }))}
            accent="#2196d3"
          />
        </div>
        </>
      )}
      {dashboardMode === 'sleep' && (
        <div className="annual-heatmap-board">
          <MetricHeatmap
            title="睡眠热力图"
            unit="分钟"
            year={heatmapYear}
            records={(sleepRecords as SleepRecord[]).map((record) => ({
              date: record.date,
              value: record.sleep_minutes,
            }))}
            accent="#8667d7"
          />
        </div>
      )}
      <KeepStats
        activities={activities}
        sleepRecords={sleepRecords as SleepRecord[]}
        filter={dashboardFilter}
        onActivitySelectionChange={handleStatsSelection}
      />
      {dashboardMode === 'workout' && (
        <div className="shuju-list">
          <RunTable
            runs={runs}
            locateActivity={locateActivityInline}
            setActivity={setActivity}
            runIndex={runIndex}
            setRunIndex={setRunIndex}
          />
        </div>
      )}
      <Analytics />
    </Layout>
  );
};

export default Index;
