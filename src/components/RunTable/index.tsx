import React, { useMemo } from 'react';
import { Activity, RunIds } from '@/utils/utils';
import RunRow from './RunRow';
import WorkoutDetailPanel from '@/components/WorkoutDetailPanel';
import styles from './style.module.scss';

interface IRunTableProperties {
  runs: Activity[];
  locateActivity: (_runIds: RunIds) => void;
  setActivity: (_runs: Activity[]) => void;
  runIndex: number;
  setRunIndex: (_index: number) => void;
}

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide']);
const RUN_WALK_TYPES = new Set(['Run', 'Hike', 'Trail Run', 'Walk', 'Treadmill', 'VirtualRun']);
const ITEMS_PER_ROW = 1;

const RunTable = ({
  runs,
  locateActivity,
  setActivity,
  runIndex,
  setRunIndex,
}: IRunTableProperties) => {
  const { rideYearlyMaxId, rideMonthlyMaxIds, rwYearlyMaxId, rwMonthlyMaxIds } = useMemo(() => {
    if (!runs || runs.length === 0) {
      return { 
        rideYearlyMaxId: -1, rideMonthlyMaxIds: new Set<number>(), 
        rwYearlyMaxId: -1, rwMonthlyMaxIds: new Set<number>() 
      };
    }
    
    let rideYMaxDist = 0, rideYMaxId = -1;
    const rideMMaxDist = new Map<string, number>(), rideMMaxId = new Map<string, number>();
    
    let rwYMaxDist = 0, rwYMaxId = -1;
    const rwMMaxDist = new Map<string, number>(), rwMMaxId = new Map<string, number>();
    
    runs.forEach(run => {
      const dist = run.distance;
      const month = run.start_date_local.slice(5, 7);
      
      if (RIDE_TYPES.has(run.type)) {
        if (dist > rideYMaxDist) { rideYMaxDist = dist; rideYMaxId = run.run_id; }
        if (dist > (rideMMaxDist.get(month) || 0)) { rideMMaxDist.set(month, dist); rideMMaxId.set(month, run.run_id); }
      } 
      else if (RUN_WALK_TYPES.has(run.type)) {
        if (dist > rwYMaxDist) { rwYMaxDist = dist; rwYMaxId = run.run_id; }
        if (dist > (rwMMaxDist.get(month) || 0)) { rwMMaxDist.set(month, dist); rwMMaxId.set(month, run.run_id); }
      }
    });
    
    const rideMIds = new Set<number>();
    rideMMaxId.forEach((id) => { if (id !== rideYMaxId) rideMIds.add(id); });
    
    const rwMIds = new Set<number>();
    rwMMaxId.forEach((id) => { if (id !== rwYMaxId) rwMIds.add(id); });
    
    return { 
      rideYearlyMaxId: rideYMaxId, rideMonthlyMaxIds: rideMIds, 
      rwYearlyMaxId: rwYMaxId, rwMonthlyMaxIds: rwMIds 
    };
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    // 🌟 终极性能优化：利用字符串 localeCompare 替代 new Date() 解析，性能提升数倍
    return [...runs].sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
  }, [runs]);

  const groupedRuns = useMemo(() => {
    const groups: Array<Array<{ run: Activity; elementIndex: number }>> = [];

    filteredRuns.forEach((run, elementIndex) => {
      const rowIndex = Math.floor(elementIndex / ITEMS_PER_ROW);
      if (!groups[rowIndex]) {
        groups[rowIndex] = [];
      }

      groups[rowIndex].push({ run, elementIndex });
    });

    return groups;
  }, [filteredRuns]);

  return (
    <div className={styles.tableContainer}>
      <div className={styles.cardList}>
        {groupedRuns.map((group, groupIndex) => {
          const expandedRun = group.find(item => item.elementIndex === runIndex)?.run;

          return (
            <div className={styles.cardGroup} key={group[0]?.run.run_id ?? groupIndex}>
              <div className={styles.cardRow}>
                {group.map(({ run, elementIndex }) => (
                  <RunRow
                    key={run.run_id}
                    elementIndex={elementIndex}
                    locateActivity={locateActivity}
                    run={run}
                    runIndex={runIndex}
                    setRunIndex={setRunIndex}
                    isRideYearlyMax={run.run_id === rideYearlyMaxId}
                    isRideMonthlyMax={rideMonthlyMaxIds.has(run.run_id)}
                    isRwYearlyMax={run.run_id === rwYearlyMaxId}
                    isRwMonthlyMax={rwMonthlyMaxIds.has(run.run_id)}
                  />
                ))}
              </div>

              {expandedRun && (
                <div className={styles.expandedDetail}>
                  <WorkoutDetailPanel run={expandedRun} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RunTable;
