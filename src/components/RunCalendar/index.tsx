import React, { useState, useMemo, useEffect } from 'react';
import { Activity, RunIds, colorFromType, formatRunName } from '@/utils/utils';
import styles from './style.module.scss';

interface IRunCalendarProps {
  runs: Activity[];
  locateActivity: (_runIds: RunIds) => void;
  runIndex: number;
  setRunIndex: (_index: number) => void;
  year: string;
}

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide']);
const WALK_TYPES = new Set(['Walk', 'Hike']); 
const RUN_TYPES = new Set(['Run', 'TrailRun', 'Treadmill', 'VirtualRun']);
const SWIM_TYPES = new Set(['Swim', 'WaterSport']); 
const RUN_WALK_TYPES = new Set(['Run', 'Hike', 'TrailRun', 'Walk', 'Treadmill', 'VirtualRun']);

function useRunDataEngine(runs: Activity[], year: string, monthIndex: number) {
  const displayYear = Number(year);

  const { normalizedRuns, runIdIndexMap, runsByMonth } = useMemo(() => {
    const indexMap = new Map<number, number>();
    const monthMap = new Map<number, { runs: any[], runsByDate: Map<string, any[]> }>();
    
    const normRuns = runs.map((r, i) => {
      indexMap.set(r.run_id, i);
      const dateStr = r.start_date_local.slice(0, 10);
      const month = Number(dateStr.slice(5, 7)) - 1;
      const cleanDateString = r.start_date_local.replace(' ', 'T');
      
      const utcDayTimestamp = new Date(`${dateStr}T00:00:00Z`).getTime();
      const exactTime = new Date(cleanDateString).getTime();
      const hour = new Date(cleanDateString).getHours(); 
      
      return { ...r, dateStr, month, utcDayTimestamp, exactTime, hour };
    });

    normRuns.forEach(r => {
      if (!monthMap.has(r.month)) {
        monthMap.set(r.month, { runs: [], runsByDate: new Map() });
      }
      const m = monthMap.get(r.month)!;
      m.runs.push(r);
      if (!m.runsByDate.has(r.dateStr)) m.runsByDate.set(r.dateStr, []);
      m.runsByDate.get(r.dateStr)!.push(r);
    });

    monthMap.forEach(m => {
      m.runsByDate.forEach(dayRuns => {
        if (dayRuns.length > 1) {
          dayRuns.sort((a, b) => a.exactTime - b.exactTime);
        }
      });
    });

    return { normalizedRuns: normRuns, runIdIndexMap: indexMap, runsByMonth: monthMap };
  }, [runs]);

  const globalData = useMemo(() => {
    let totalDist = 0, rideDist = 0, runDist = 0, walkDist = 0;
    const datesSet = new Set<number>();
    
    const firstDayUTC = Date.UTC(displayYear, 0, 1);
    const lastDayUTC = Date.UTC(displayYear, 11, 31);
    const totalWeeks = Math.ceil((lastDayUTC - firstDayUTC) / 86400000 / 7) + 1;
    const weekData = new Array(totalWeeks).fill(0);
    
    const rideDistMap = new Map<string, number>(); 
    const rwDistMap = new Map<string, number>();

    normalizedRuns.forEach(r => {
      totalDist += r.distance;
      if (RIDE_TYPES.has(r.type)) {
        rideDist += r.distance;
      } else if (RUN_TYPES.has(r.type)) {
        runDist += r.distance;
      } else if (WALK_TYPES.has(r.type)) {
        walkDist += r.distance;
      }
      datesSet.add(r.utcDayTimestamp);

      const diffDays = Math.floor((r.utcDayTimestamp - firstDayUTC) / 86400000);
      const week = Math.max(0, Math.min(totalWeeks - 1, Math.floor(diffDays / 7)));
      weekData[week] += r.distance;
      
      if (RIDE_TYPES.has(r.type)) {
        rideDistMap.set(r.dateStr, (rideDistMap.get(r.dateStr) || 0) + r.distance);
      }
      if (RUN_WALK_TYPES.has(r.type)) {
        rwDistMap.set(r.dateStr, (rwDistMap.get(r.dateStr) || 0) + r.distance);
      }
    });

    const activeDays = datesSet.size;
    let maxStreak = 0;
    if (activeDays > 0) {
      const timestamps = Array.from(datesSet).sort((a, b) => a - b);
      maxStreak = 1; let currStreak = 1;
      for (let i = 1; i < timestamps.length; i++) {
        const diffDays = (timestamps[i] - timestamps[i - 1]) / 86400000;
        if (diffDays === 1) { currStreak++; maxStreak = Math.max(maxStreak, currStreak); } 
        else if (diffDays > 1) { currStreak = 1; }
      }
    }

    const sparklineData = weekData.map((val, idx, arr) => {
      const prev = arr[idx - 1] !== undefined ? arr[idx - 1] : val;
      const next = arr[idx + 1] !== undefined ? arr[idx + 1] : val;
      return prev * 0.25 + val * 0.5 + next * 0.25;
    });

    const sparklineMax = Math.max(...sparklineData, 1);

    let rideYMax = 0, rideYDate = '';
    const rideMMax = new Map<number, number>(), rideMDate = new Map<number, string>();
    rideDistMap.forEach((dist, dateStr) => {
      const month = Number(dateStr.slice(5, 7)) - 1;
      if (dist > rideYMax) { rideYMax = dist; rideYDate = dateStr; }
      if (dist > (rideMMax.get(month) || 0)) { rideMMax.set(month, dist); rideMDate.set(month, dateStr); }
    });

    let rwYMax = 0, rwYDate = '';
    const rwMMax = new Map<number, number>(), rwMDate = new Map<number, string>();
    rwDistMap.forEach((dist, dateStr) => {
      const month = Number(dateStr.slice(5, 7)) - 1;
      if (dist > rwYMax) { rwYMax = dist; rwYDate = dateStr; }
      if (dist > (rwMMax.get(month) || 0)) { rwMMax.set(month, dist); rwMDate.set(month, dateStr); }
    });

    return {
      stats: {
        totalDist: totalDist / 1000,
        rideDist: rideDist / 1000,
        runDist: runDist / 1000,
        walkDist: walkDist / 1000,
        activeDays,
        maxStreak
      },
      sparklineData,
      sparklineMax,
      rideYearlyMaxDate: rideYDate,    
      rideMonthlyMaxDates: rideMDate,
      runWalkYearlyMaxDate: rwYDate,   
      runWalkMonthlyMaxDates: rwMDate  
    };
  }, [normalizedRuns, displayYear]);

  const monthlyData = useMemo(() => {
    const monthData = runsByMonth.get(monthIndex) || { runs: [], runsByDate: new Map() };
    const { runs: currentRuns, runsByDate: runsMap } = monthData;
    
    let mTotal = 0, mRide = 0, mRun = 0, mWalk = 0; 
    const timeBlocks = new Array(8).fill(0);
    const hrCounts = new Array(5).fill(0);
    let validHrRuns = 0;
    let maxTimeBlockCount = 0;

    currentRuns.forEach(r => {
      mTotal += r.distance;
      if (RIDE_TYPES.has(r.type)) mRide += r.distance; 
      else if (RUN_TYPES.has(r.type)) mRun += r.distance; 
      else if (WALK_TYPES.has(r.type)) mWalk += r.distance; 

      const blockIndex = Math.floor(r.hour / 3);
      timeBlocks[blockIndex]++;
      if (timeBlocks[blockIndex] > maxTimeBlockCount) maxTimeBlockCount = timeBlocks[blockIndex];

      const hr = r.average_heartrate;
      if (hr && hr > 0) {
        validHrRuns++;
        if (hr < 115) hrCounts[0]++; else if (hr < 130) hrCounts[1]++;
        else if (hr < 145) hrCounts[2]++; else if (hr < 160) hrCounts[3]++;
        else hrCounts[4]++;
      }
    });

    const personas = [
      { name: '午夜潜行', time: '00:00-03:00' }, { name: '破晓先锋', time: '03:00-06:00' },
      { name: '晨光逐风', time: '06:00-09:00' }, { name: '骄阳行者', time: '09:00-12:00' },
      { name: '烈日独行', time: '12:00-15:00' }, { name: '午后追风', time: '15:00-18:00' },
      { name: '暮色掠影', time: '18:00-21:00' }, { name: '暗夜游侠', time: '21:00-24:00' }
    ];
    let peakPersona = '等待记录';
    if (maxTimeBlockCount > 0) peakPersona = personas[timeBlocks.indexOf(maxTimeBlockCount)].name;

    const hrMaxIndex = hrCounts.indexOf(Math.max(...hrCounts));
    const hrZonesInfo = [
      { color: '#99FF00', title: '舒缓有氧', name: 'Z1', range: '<115' },
      { color: '#FFFF00', title: '稳态燃脂', name: 'Z2', range: '115-129' },
      { color: '#FF9900', title: '有氧强化', name: 'Z3', range: '130-144' },
      { color: '#FF3300', title: '乳酸阈值', name: 'Z4', range: '145-159' },
      { color: '#FF0000', title: '无氧极限', name: 'Z5', range: '≥160' },
    ];

    return {
      runsByDate: runsMap,
      monthDetailStats: {
        totalDist: mTotal / 1000,
        rideDist: mRide / 1000,
        runDist: mRun / 1000,
        walkDist: mWalk / 1000,
      },
      insights: {
        hasActivities: currentRuns.length > 0, timeBlocks, maxTimeBlockCount: Math.max(maxTimeBlockCount, 1),
        peakPersona, personas, validHrRuns, hrCounts, hrZonesInfo, hrMaxZone: hrZonesInfo[hrMaxIndex]
      }
    };
  }, [runsByMonth, monthIndex]);

  return { displayYear, normalizedRuns, runIdIndexMap, globalData, monthlyData };
}

// 🌟 提取通用 SVG 图标渲染函数（与 RunRow 保持绝对一致）
const getActivityIcon = (type: string) => {
  if (RIDE_TYPES.has(type)) {
    return (
      <svg viewBox="0 -1 26 26" fill="currentColor">
        <path d="M5.5 21a4.5 4.5 0 1 1 0-9a4.5 4.5 0 0 1 0 9m0-2a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m13 2a4.5 4.5 0 1 1 0-9a4.5 4.5 0 0 1 0 9m0-2a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m-7.477-8.695L13 12v6h-2v-5l-2.719-2.266A2 2 0 0 1 8 7.671l2.828-2.828a2 2 0 0 1 2.829 0l1.414 1.414a6.97 6.97 0 0 0 3.917 1.975l-.01 2.015a8.96 8.96 0 0 1-5.321-2.575zM16 5a2 2 0 1 1 0-4a2 2 0 0 1 0 4"/>
      </svg>
    );
  }
  if (WALK_TYPES.has(type)) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.61713 8.71233L10.8222 6.38373C11.174 6.12735 11.6087 5.98543 12.065 6.0008C13.1764 6.02813 14.1524 6.75668 14.4919 7.82036C14.6782 8.40431 14.8481 8.79836 15.0017 9.0025C15.914 10.2155 17.3655 11 19.0002 11V13C16.8255 13 14.8825 12.0083 13.5986 10.4526L12.901 14.4085L14.9621 16.138L17.1853 22.246L15.3059 22.93L13.266 17.3256L9.87576 14.4808C9.32821 14.0382 9.03139 13.3192 9.16231 12.5767L9.67091 9.6923L8.99407 10.1841L6.86706 13.1116L5.24902 11.9361L7.60016 8.7L7.61713 8.71233ZM13.5002 5.5C12.3956 5.5 11.5002 4.60457 11.5002 3.5C11.5002 2.39543 12.3956 1.5 13.5002 1.5C14.6047 1.5 15.5002 2.39543 15.5002 3.5C15.5002 4.60457 14.6047 5.5 13.5002 5.5ZM10.5286 18.6813L7.31465 22.5116L5.78257 21.226L8.75774 17.6803L9.50426 15.5L11.2954 17L10.5286 18.6813Z"></path>
      </svg>
    );
  }
  if (RUN_TYPES.has(type)) {
    return (
      <svg viewBox="0 0 640 640" fill="currentColor">
        <path d="M352.5 32c30.9 0 56 25.1 56 56s-25.1 56-56 56s-56-25.1-56-56s25.1-56 56-56M219.6 240c-3.3 0-6.2 2-7.4 5l-22 54.9c-6.6 16.4-25.2 24.4-41.6 17.8s-24.4-25.2-17.8-41.6l21.9-54.9c11-27.3 37.4-45.2 66.9-45.2h97.3c28.5 0 54.8 15.1 69.1 39.7l32.8 56.3h61.6c17.7 0 32 14.3 32 32s-14.3 32-32 32h-61.6c-22.8 0-43.8-12.1-55.3-31.8l-10-17.1l-20.7 70.4l75.4 22.6c27.7 8.3 41.8 39 30.1 65.5L381.7 573c-7.2 16.2-26.1 23.4-42.2 16.2s-23.4-26.1-16.2-42.2l49.2-110.8l-95.9-28.8c-32.7-9.8-52-43.7-43.7-76.8l22.7-90.6h-35.9zm-8 181c13.3 14.9 30.7 26.3 51.2 32.4l4.7 1.4l-6.9 19.3c-5.8 16.3-16 30.8-29.3 41.8l-82.4 67.9c-13.6 11.2-33.8 9.3-45-4.3s-9.3-33.8 4.3-45l82.4-67.9c4.5-3.7 7.8-8.5 9.8-13.9z"/>
      </svg>
    );
  }
  return <span style={{ fontSize: '14px' }}>🏅</span>;
};

const RunCalendar = ({ runs, locateActivity, runIndex, setRunIndex, year }: IRunCalendarProps) => {
  const [monthIndex, setMonthIndex] = useState<number>(new Date().getMonth());
  const [direction, setDirection] = useState<number>(0);

  const engine = useRunDataEngine(runs, year, monthIndex);

  useEffect(() => {
    if (engine.normalizedRuns.length > 0) {
      setMonthIndex(engine.normalizedRuns[0].month);
      setDirection(0);
    }
  }, [engine.normalizedRuns]);

  const sparklinePath = useMemo(() => {
    const data = engine.globalData.sparklineData;
    if (data.length === 0) return '';
    const width = 200, height = 40, pad = 6;
    const max = engine.globalData.sparklineMax; 
    
    const points = data.map((d, i) => ({
      x: (i / (data.length - 1 || 1)) * width,
      y: height - pad - (d / max) * (height - 2 * pad)
    }));
    if (points.length === 1) return `M 0,${points[0].y} L ${width},${points[0].y}`;

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2 < points.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6, cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
      cp1y = Math.max(pad, Math.min(height - pad, cp1y));
      cp2y = Math.max(pad, Math.min(height - pad, cp2y));
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }, [engine.globalData.sparklineData, engine.globalData.sparklineMax]); 

  const handlePrevMonth = () => { setDirection(-1); setMonthIndex(prev => Math.max(0, prev - 1)); };
  const handleNextMonth = () => { setDirection(1); setMonthIndex(prev => Math.min(11, prev + 1)); };

  const rawFirstDay = new Date(engine.displayYear, monthIndex, 1).getDay();
  const firstDayOfMonth = rawFirstDay === 0 ? 6 : rawFirstDay - 1; 

  const daysInMonth = new Date(engine.displayYear, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: firstDayOfMonth }, () => null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  return (
    <div className={styles.boardContainer}>
      {/* 🌟 去掉了原本占用 DOM 却不再使用的 SVG <defs> 渐变代码，更干净了！ */}

      <div className={styles.globalSection}>
        {sparklinePath && (
          <svg key={year} className={styles.sparkline} viewBox="0 0 200 40" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs><linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#32D74B" stopOpacity="0.25" /><stop offset="100%" stopColor="#32D74B" stopOpacity="0" /></linearGradient></defs>
            <path d={`${sparklinePath} L 200,40 L 0,40 Z`} fill="url(#sparklineGrad)" stroke="none" className={styles.sparklineFill} />
            <path d={sparklinePath} fill="none" className={styles.sparklineLine} />
          </svg>
        )}
        
        <div className={styles.globalTitle}>年度总里程</div>

        <div className={styles.globalMainStat}>
          <span className={styles.val}>{engine.globalData.stats.totalDist.toFixed(1)}</span>
          <span className={styles.unit}>KM</span>
        </div>
        
        <div className={styles.metricsRow}>
          <div className={styles.metricBlock}><span className={styles.metricLabel}>骑行</span><span className={styles.metricValue}>{engine.globalData.stats.rideDist.toFixed(0)}<small>km</small></span></div>
          <div className={styles.metricBlock}><span className={styles.metricLabel}>跑步</span><span className={styles.metricValue}>{engine.globalData.stats.runDist.toFixed(0)}<small>km</small></span></div>
          <div className={styles.metricBlock}><span className={styles.metricLabel}>行走</span><span className={styles.metricValue}>{engine.globalData.stats.walkDist.toFixed(0)}<small>km</small></span></div>
          <div className={styles.metricBlock}><span className={styles.metricLabel}>运动</span><span className={styles.metricValue}>{engine.globalData.stats.activeDays}<small>天</small></span></div>
        </div>
      </div>

      <div className={styles.calendarSection}>
        <div className={styles.monthHeader}>
          <div className={styles.monthNav}>
            <button onClick={handlePrevMonth} disabled={monthIndex === 0} title="上个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></button>
            <span>{engine.displayYear}-{String(monthIndex + 1).padStart(2, '0')}</span>
            <button onClick={handleNextMonth} disabled={monthIndex === 11} title="下个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></button>
          </div>
        </div>
        
        <div className={styles.weekdays}>{['一', '二', '三', '四', '五', '六', '日'].map((d, i) => (<div key={i}>{d}</div>))}</div>
        
        <div key={`${engine.displayYear}-${monthIndex}`} className={styles.grid} data-direction={direction}>
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className={styles.emptyDay} />;
            const dateStr = `${engine.displayYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRuns = engine.monthlyData.runsByDate.get(dateStr) || [];
            const hasRun = dayRuns.length > 0;
            const primaryRun = hasRun ? dayRuns[0] : null;
            const runColor = primaryRun ? colorFromType(primaryRun.type) : '#32D74B';
            const isSelected = hasRun && runs[runIndex]?.run_id === primaryRun?.run_id;
            
            const isRawRideYearlyMax = dateStr === engine.globalData.rideYearlyMaxDate;
            const isRawRideMonthlyMax = dateStr === engine.globalData.rideMonthlyMaxDates.get(monthIndex);
            const isRawRwYearlyMax = dateStr === engine.globalData.runWalkYearlyMaxDate;
            const isRawRwMonthlyMax = dateStr === engine.globalData.runWalkMonthlyMaxDates.get(monthIndex);

            const isRideYearlyMax = isRawRideYearlyMax;
            const isRideMonthlyMax = !isRideYearlyMax && isRawRideMonthlyMax;
            const isRunWalkYearlyMax = isRawRwYearlyMax; 
            const isRunWalkMonthlyMax = !isRunWalkYearlyMax && isRawRwMonthlyMax;
            
            const isGold = isRideYearlyMax || isRunWalkYearlyMax;
            const isSilver = isRideMonthlyMax || isRunWalkMonthlyMax;
            const hasAnyAchievement = isGold || isSilver;

            // 🌟 完全平移列表区的高级金属光晕勋章设计，替换掉原来的星星 SVG 和多色点点！
            let indicatorDom = null;
            if (hasAnyAchievement && primaryRun) {
              const ringClass = isGold ? `${styles.calIconRing} ${styles.goldRing}` : `${styles.calIconRing} ${styles.silverRing}`;
              indicatorDom = (
                <div className={ringClass} style={{ color: colorFromType(primaryRun.type) }}>
                  {getActivityIcon(primaryRun.type)}
                </div>
              );
            } else if (dayRuns.length > 1) {
              // 普通的一天多次运动，依然保留极简小点点
              indicatorDom = <span className={styles.multiDot} />;
            }

            return (
              <div 
                key={dateStr} 
                className={`${styles.dayCell} ${hasRun ? styles.hasRun : ''} ${isSelected ? styles.selected : ''} ${hasAnyAchievement ? styles.maxDay : ''}`} 
                onClick={() => { if (hasRun && primaryRun) { if (isSelected) { locateActivity([]); setRunIndex(-1); } else { locateActivity([primaryRun.run_id]); setRunIndex(engine.runIdIndexMap.get(primaryRun.run_id) ?? -1); } } }} 
                style={{ 
                  backgroundColor: (isSelected && !hasAnyAchievement) ? `${runColor}26` : undefined, 
                  boxShadow: (isSelected && !hasAnyAchievement) ? `inset 0 0 0 1px ${runColor}` : undefined 
                }}
              >
                {hasRun && (
                  <div className={styles.runTooltip}>
                    <div className={styles.ttList}>
                      {dayRuns.map((r) => (
                        <div key={r.run_id} className={styles.ttItem}>
                          <span className={styles.ttName}>{formatRunName(r.name, r.start_date_local, r.type)}</span>
                          <span className={styles.ttVal} style={{ color: colorFromType(r.type) }}>{(r.distance / 1000).toFixed(1)} <small>km</small></span>
                        </div>
                      ))}
                    </div>
                    
                    {hasAnyAchievement && (
                      <div className={styles.ttAchievement} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                        {isRideYearlyMax && (
                          <span style={{ color: '#FFD447', display: 'flex', alignItems: 'center' }}>
                            年度最远 <span className={styles.titleTag} style={{ marginLeft: '6px' }}>骑行</span>
                          </span>
                        )}
                        {isRideMonthlyMax && (
                          <span style={{ color: '#E5E5EA', display: 'flex', alignItems: 'center' }}>
                            月度最远 <span className={styles.titleTag} style={{ marginLeft: '6px' }}>骑行</span>
                          </span>
                        )}
                        {isRunWalkYearlyMax && (
                          <span style={{ color: '#FFD700', display: 'flex', alignItems: 'center' }}>
                            年度最远 <span className={styles.titleTag} style={{ marginLeft: '6px' }}>跑走</span>
                          </span>
                        )}
                        {isRunWalkMonthlyMax && (
                          <span style={{ color: '#E5E5EA', display: 'flex', alignItems: 'center' }}>
                            月度最远 <span className={styles.titleTag} style={{ marginLeft: '6px' }}>跑走</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 🌟 只有在没有打破记录时，才渲染日期的数字。一旦打破记录，光晕勋章接管整个格子，极具尊贵感！ */}
                {!hasAnyAchievement && (
                  <span className={styles.dateNum} style={{ color: hasRun ? runColor : 'inherit', opacity: hasRun ? 1 : 0.3, fontWeight: hasRun ? 800 : 500, textShadow: hasRun ? `0 0 8px ${runColor}40` : 'none' }}>
                    {day}
                  </span>
                )}
                
                {indicatorDom}
              </div>
            );
          })}
        </div>

        <div className={styles.monthFooter}>
          <div className={styles.monthFooterLine}>
            里程 <span>{engine.monthlyData.monthDetailStats.totalDist.toFixed(1)}</span> km 
            <span className={styles.dot}>•</span> 骑行 <span>{engine.monthlyData.monthDetailStats.rideDist.toFixed(1)}</span> km
          </div>
          <div className={styles.monthFooterLine}>
            跑步 <span>{engine.monthlyData.monthDetailStats.runDist.toFixed(1)}</span> km
            <span className={styles.dot}>•</span> 行走 <span>{engine.monthlyData.monthDetailStats.walkDist.toFixed(1)}</span> km
          </div>
        </div>
      </div>

      <div className={styles.monthlyInsights}>
        <div className={styles.insightCard}>
          <div className={styles.insightHeader}>
            <span className={styles.insightTitle}>{engine.monthlyData.insights.hasActivities ? engine.monthlyData.insights.peakPersona : '等待记录'}<span className={styles.titleTag}>时段</span></span>
          </div>
          <div className={styles.insightContent}>
            <div className={styles.punchCard}>
              {engine.monthlyData.insights.timeBlocks.map((count, i) => (
                <div key={i} className={styles.barWrapper}>
                  <div className={styles.punchHole} style={{ backgroundColor: count > 0 ? `rgba(50, 215, 75, ${0.3 + 0.7 * (count / engine.monthlyData.insights.maxTimeBlockCount)})` : 'rgba(255,255,255,0.04)' }} />
                  <div className={styles.runTooltip}>
                    <div className={styles.ttItem}><span className={styles.ttName} style={{ color: '#8E8E93', fontSize: '0.8rem' }}>{engine.monthlyData.insights.personas[i].time}</span><span className={styles.ttVal}>{count} <small>趟</small></span></div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.insightLabels}><span>00:00</span><span>12:00</span><span>24:00</span></div>
          </div>
        </div>

        <div className={styles.insightCard}>
          <div className={styles.insightHeader}>
            <span className={styles.insightTitle}>{engine.monthlyData.insights.validHrRuns ? engine.monthlyData.insights.hrMaxZone.title : '等待记录'}<span className={styles.titleTag}>心率</span></span>
          </div>
          <div className={styles.insightContent}>
            <div className={styles.zoneChart}>
              {engine.monthlyData.insights.hrCounts.map((count, i) => (
                <div key={i} className={styles.zoneCol}>
                  <div className={styles.zoneBar} style={{ height: engine.monthlyData.insights.validHrRuns > 0 ? `${Math.max(12, (count / engine.monthlyData.insights.validHrRuns) * 100)}%` : '12%', backgroundColor: count > 0 ? engine.monthlyData.insights.hrZonesInfo[i].color : 'rgba(255,255,255,0.05)' }} />
                  <div className={styles.runTooltip}>
                    <div className={styles.ttItem}>
                      <span className={styles.ttName} style={{ color: engine.monthlyData.insights.hrZonesInfo[i].color, fontSize: '0.8rem' }}>{engine.monthlyData.insights.hrZonesInfo[i].range} <small style={{ color: engine.monthlyData.insights.hrZonesInfo[i].color }}>BPM</small></span>
                      <span className={styles.ttVal}>{count} <small>趟</small></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.insightLabels}>{engine.monthlyData.insights.hrZonesInfo.map((info, i) => (<span key={i} className={styles.zLabel}>{info.name}</span>))}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunCalendar;
