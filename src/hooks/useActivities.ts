import { useMemo } from 'react';
import {locationForRun, typeForRun} from '@/utils/utils';
import activities from '@/static/activities.json';

const useActivities = () => {
  return useMemo(() => {
    const cities: Record<string, number> = {};
    const runPeriod: Record<string, number> = {};
    const provinces: Set<string> = new Set();
    const countries: Set<string> = new Set();
    const years: Set<string> = new Set();

    activities.forEach((run) => {
      const location = locationForRun(run);
      const periodName = typeForRun(run);
      if (periodName) {
        runPeriod[periodName] = (runPeriod[periodName] || 0) + 1;
      }

      const { city, province, country } = location;
      if (city.length > 1) {
        cities[city] = (cities[city] || 0) + run.distance;
      }
      if (province) provinces.add(province);
      if (country) countries.add(country);
      years.add(run.start_date_local.slice(0, 4));
    });

    const yearsArray = [...years].sort().reverse();
    const [thisYear = ''] = yearsArray;

    return {
      activities,
      years: yearsArray,
      countries: [...countries],
      provinces: [...provinces],
      cities,
      runPeriod,
      thisYear,
    };
  }, []);
};

export default useActivities;
