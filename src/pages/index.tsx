import { useEffect, useState, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';
import RunMap from '@/components/RunMap';
import RunTable from '@/components/RunTable';
import useActivities from '@/hooks/useActivities';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import RunCalendar from '@/components/RunCalendar';
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

const Index = () => {
  const { siteTitle } = useSiteMetadata();
  const { activities, thisYear } = useActivities();
  const [year, setYear] = useState(thisYear);
  const [runIndex, setRunIndex] = useState(-1);
  
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

  const locateActivity = (runIds: RunIds) => {
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
    if (!isSticky) scrollToMap();
  };

  useEffect(() => {
    setGeoData(geoJsonForRuns(runs));
  }, [runs]);
  
  const yearArray = Array.from(new Set(activities.map((a: Activity) => a.start_date_local.slice(0, 4))));
  yearArray.sort((a, b) => b.localeCompare(a)); 
  
  return (
    <Layout>
        <div className="pagetitle">
          2025 年检查出来二型糖尿病，经过饮食及运动结合，已减重二十多斤。但随着不运动及饮食的不控制，体重开始反弹～今年的目标体重 130-140斤。
        </div>
        <ul className="buttons">
          {yearArray.map((y) => (
            <li
              key={y}
              className={`button ${year === y ? 'selected' : ''}`}
              onClick={() => changeYear(y)}
            >
              {y}
            </li>
          ))}
        </ul>
        
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
        <div className="shuju-list">
          <RunTable
            runs={runs}
            locateActivity={locateActivity}
            setActivity={setActivity}
            runIndex={runIndex}
            setRunIndex={setRunIndex}
          />
          </div>
      <Analytics />
    </Layout>
  );
};

export default Index;