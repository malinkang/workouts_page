import { useCallback, useEffect, useState, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';
import KeepStats, { SleepRecord } from '@/components/KeepStats';
import RunMap from '@/components/RunMap';
import RunTable from '@/components/RunTable';
import useActivities from '@/hooks/useActivities';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import RunCalendar from '@/components/RunCalendar';
import RunHeatmap from '@/components/RunHeatmap';
import {
  Activity,
  filterAndSortRuns,
  filterYearRuns,
  geoJsonForRuns,
  scrollToMap,
  sortDateFunc,
  titleForShow,
  RunIds,
} from '@/utils/utils';
import sleepRecords from '@/static/sleep_records.json';

type DashboardMode = 'workout' | 'sleep';

const Index = () => {
  useSiteMetadata();
  const { activities, thisYear } = useActivities();
  const [year, setYear] = useState(thisYear);
  const [runIndex, setRunIndex] = useState(-1);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('workout');
  const [statsRuns, setStatsRuns] = useState<Activity[] | null>(null);
  const [runs, setActivity] = useState(
    filterAndSortRuns(activities, year, filterYearRuns, sortDateFunc)
  );
  
  const [title, setTitle] = useState('');
  const [geoData, setGeoData] = useState(geoJsonForRuns(runs));

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

  const handleStatsSelection = useCallback((selectedActivities: Activity[]) => {
    setStatsRuns(selectedActivities);
    setRunIndex(-1);
    const selectedYear = selectedActivities[0]?.start_date_local?.slice(0, 4);
    if (selectedYear) setYear(selectedYear);
  }, []);

  useEffect(() => {
    if (statsRuns === null) return;
    const nextRuns = [...statsRuns].sort(sortDateFunc);
    setActivity(nextRuns);
    setGeoData(geoJsonForRuns(nextRuns));
    setTitle(nextRuns.length ? titleForShow(nextRuns[nextRuns.length - 1]) : '');
  }, [statsRuns]);

  return (
    <Layout>
      <KeepStats
        activities={activities}
        sleepRecords={sleepRecords as SleepRecord[]}
        mode={dashboardMode}
        onModeChange={setDashboardMode}
        onActivitySelectionChange={handleStatsSelection}
      />
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
            />
          </div>
        </div>
        <div className="annual-heatmap-board">
          <RunHeatmap
            runs={runs}
            locateActivity={locateActivity}
            setRunIndex={setRunIndex}
            year={year}
          />
        </div>
        <div className="shuju-list">
          <RunTable
            runs={runs}
            locateActivity={locateActivityInline}
            setActivity={setActivity}
            runIndex={runIndex}
            setRunIndex={setRunIndex}
          />
          </div>
        </>
      )}
      <Analytics />
    </Layout>
  );
};

export default Index;
