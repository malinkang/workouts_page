import React from 'react';
import { formatSpeedOrPace, formatRunName, colorFromType, formatRunTime, Activity, RunIds } from '@/utils/utils';
import styles from './style.module.scss';

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide']);
const WALK_TYPES = new Set(['Walk', 'Hike']); 
const RUN_TYPES = new Set(['Run', 'Trail Run', 'Treadmill', 'VirtualRun']);
const SWIM_TYPES = new Set(['Swim', 'WaterSport']); 

interface IRunRowProperties {
  elementIndex: number;
  locateActivity: (_runIds: RunIds) => void;
  run: Activity;
  runIndex: number;
  setRunIndex: (_index: number) => void;
  isRideYearlyMax?: boolean;
  isRideMonthlyMax?: boolean;
  isRwYearlyMax?: boolean;
  isRwMonthlyMax?: boolean;
}

const RunRow = ({ 
  elementIndex, locateActivity, run, runIndex, setRunIndex, 
  isRideYearlyMax, isRideMonthlyMax, isRwYearlyMax, isRwMonthlyMax 
}: IRunRowProperties) => {
  const distance = (run.distance / 1000.0).toFixed(2);
  const paceParts = run.average_speed ? formatSpeedOrPace(run.average_speed, run.type) : null;
  const heartRate = run.average_heartrate;
  const type = run.type;
  const isRide = RIDE_TYPES.has(type);
  const runTime = formatRunTime(run.moving_time);
  const themeColor = colorFromType(type);
  
  const handleClick = () => {
    if (runIndex === elementIndex) {
      setRunIndex(-1);
      locateActivity([]);
      return;
    }
    setRunIndex(elementIndex);
    locateActivity([run.run_id]);
  };
  
  const dateStr = run.start_date_local || '';
  const datePart = dateStr.length >= 10 ? dateStr.slice(5, 10) : ''; 
  const timePart = dateStr.length >= 16 ? dateStr.slice(11, 16) : ''; 

  const getActivityIcon = () => {
    if (isRide) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -1 26 26">
          <path fill="currentColor" d="M5.5 21a4.5 4.5 0 1 1 0-9a4.5 4.5 0 0 1 0 9m0-2a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m13 2a4.5 4.5 0 1 1 0-9a4.5 4.5 0 0 1 0 9m0-2a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m-7.477-8.695L13 12v6h-2v-5l-2.719-2.266A2 2 0 0 1 8 7.671l2.828-2.828a2 2 0 0 1 2.829 0l1.414 1.414a6.97 6.97 0 0 0 3.917 1.975l-.01 2.015a8.96 8.96 0 0 1-5.321-2.575zM16 5a2 2 0 1 1 0-4a2 2 0 0 1 0 4"/>
        </svg>
      );
    }
    if (WALK_TYPES.has(type)) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7.61713 8.71233L10.8222 6.38373C11.174 6.12735 11.6087 5.98543 12.065 6.0008C13.1764 6.02813 14.1524 6.75668 14.4919 7.82036C14.6782 8.40431 14.8481 8.79836 15.0017 9.0025C15.914 10.2155 17.3655 11 19.0002 11V13C16.8255 13 14.8825 12.0083 13.5986 10.4526L12.901 14.4085L14.9621 16.138L17.1853 22.246L15.3059 22.93L13.266 17.3256L9.87576 14.4808C9.32821 14.0382 9.03139 13.3192 9.16231 12.5767L9.67091 9.6923L8.99407 10.1841L6.86706 13.1116L5.24902 11.9361L7.60016 8.7L7.61713 8.71233ZM13.5002 5.5C12.3956 5.5 11.5002 4.60457 11.5002 3.5C11.5002 2.39543 12.3956 1.5 13.5002 1.5C14.6047 1.5 15.5002 2.39543 15.5002 3.5C15.5002 4.60457 14.6047 5.5 13.5002 5.5ZM10.5286 18.6813L7.31465 22.5116L5.78257 21.226L8.75774 17.6803L9.50426 15.5L11.2954 17L10.5286 18.6813Z"></path></svg>
      );
    }
    if (RUN_TYPES.has(type)) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 640 640"><path fill="currentColor" d="M352.5 32c30.9 0 56 25.1 56 56s-25.1 56-56 56s-56-25.1-56-56s25.1-56 56-56M219.6 240c-3.3 0-6.2 2-7.4 5l-22 54.9c-6.6 16.4-25.2 24.4-41.6 17.8s-24.4-25.2-17.8-41.6l21.9-54.9c11-27.3 37.4-45.2 66.9-45.2h97.3c28.5 0 54.8 15.1 69.1 39.7l32.8 56.3h61.6c17.7 0 32 14.3 32 32s-14.3 32-32 32h-61.6c-22.8 0-43.8-12.1-55.3-31.8l-10-17.1l-20.7 70.4l75.4 22.6c27.7 8.3 41.8 39 30.1 65.5L381.7 573c-7.2 16.2-26.1 23.4-42.2 16.2s-23.4-26.1-16.2-42.2l49.2-110.8l-95.9-28.8c-32.7-9.8-52-43.7-43.7-76.8l22.7-90.6h-35.9zm-8 181c13.3 14.9 30.7 26.3 51.2 32.4l4.7 1.4l-6.9 19.3c-5.8 16.3-16 30.8-29.3 41.8l-82.4 67.9c-13.6 11.2-33.8 9.3-45-4.3s-9.3-33.8 4.3-45l82.4-67.9c4.5-3.7 7.8-8.5 9.8-13.9z"/></svg>
      );
    }
    if (SWIM_TYPES.has(type)) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 13c.5.5 2.13-.112 3.262-.5c1.46-.5 3.238 0 2.738-.5l-2-2s-4.5 2.5-4 3m-9 7c2 0 3-1 5-1s3 1 5 1s3-1 5-1s3 1 5 1M2 16c2 0 3-1 5-1s3 1 5 1s3-1 5-1s3 1 5 1M17.5 4l-5.278 3l3.278 3.5L12 12m7.222-2a1 1 0 1 0 0-2a1 1 0 0 0 0 2"/></svg>
      );
    }
    return '🏅';
  };

  let paceNum: React.ReactNode = '';
  let paceUnit = '';

  if (paceParts) {
    if (Array.isArray(paceParts)) {
      paceNum = paceParts[0];
      paceUnit = paceParts[1] as string;
    } else if (typeof paceParts === 'string') {
      if (paceParts.includes('km/h')) {
        paceNum = paceParts.replace(/km\/h/i, '').trim();
        paceUnit = 'km/h';
      } else if (paceParts.includes('/100m')) {
        paceNum = paceParts.replace(/\/100m/i, '').trim();
        paceUnit = '/100m';
      } else {
        paceNum = paceParts.replace(' ', '');
        paceUnit = '';
      }
    }
  }

  const stats = [
    { label: '用时', num: runTime, unit: '' }
  ];
  if (paceNum) stats.push({ label: isRide ? '均速' : '配速', num: paceNum, unit: paceUnit });
  
  if (heartRate && heartRate > 0) stats.push({ label: '心率', num: heartRate.toFixed(0), unit: '' });

  let ringClass = styles.iconRing;
  let iconColor = themeColor;

  if (isRideYearlyMax || isRwYearlyMax) {
    ringClass = `${styles.iconRing} ${styles.goldRing}`;
  } else if (isRideMonthlyMax || isRwMonthlyMax) {
    ringClass = `${styles.iconRing} ${styles.silverRing}`;
  }

  const hasAnyAchievement = isRideYearlyMax || isRideMonthlyMax || isRwYearlyMax || isRwMonthlyMax;

  return (
    <div
      className={`${styles.runCard} ${runIndex === elementIndex ? styles.selectedCard : ''}`}
      onClick={handleClick}
    >
      <div className={ringClass} style={{ color: iconColor }}>
        {getActivityIcon()}
      </div>

      <div className={styles.cardContent}>
        <div className={styles.leftInfo}>
          <div className={styles.runName}>{formatRunName(run.name, run.start_date_local, run.type)}</div>
          <div className={styles.runDistance} style={{ color: themeColor }}>
            {distance}<span className={styles.distUnit}>km</span>
          </div>
        </div>

        <div className={styles.rightInfo}>
          <div className={styles.runDate}>{datePart} {timePart}</div>
        </div>
      </div>

      <div className={styles.runTooltip}>
        <div className={styles.ttList}>
          {stats.map((s, i) => (
            <div key={i} className={styles.ttItem}>
              <div className={styles.ttNameWrap}>
                <span className={styles.ttName}>{s.label}</span>
                {s.unit && <span className={styles.ttUnitTag}>{s.unit}</span>}
              </div>
              <span className={styles.ttNum}>{s.num}</span>
            </div>
          ))}
        </div>
        
        {hasAnyAchievement && (
          <div className={styles.ttAchievement} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            {isRideYearlyMax && (
              <span style={{ color: '#FFD447', display: 'flex', alignItems: 'center' }}>
                年度单次最远 <span className={styles.titleTag} style={{ marginLeft: '6px' }}>骑行</span>
              </span>
            )}
            {isRideMonthlyMax && !isRideYearlyMax && (
              <span style={{ color: '#E5E5EA', display: 'flex', alignItems: 'center' }}>
                月度单次最远 <span className={styles.titleTag} style={{ marginLeft: '6px' }}>骑行</span>
              </span>
            )}
            {isRwYearlyMax && (
              <span style={{ color: '#FFD447', display: 'flex', alignItems: 'center' }}>
                年度单次最远 <span className={styles.titleTag} style={{ marginLeft: '6px' }}>跑走</span>
              </span>
            )}
            {isRwMonthlyMax && !isRwYearlyMax && (
              <span style={{ color: '#E5E5EA', display: 'flex', alignItems: 'center' }}>
                月度单次最远 <span className={styles.titleTag} style={{ marginLeft: '6px' }}>跑走</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RunRow;