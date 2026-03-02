import MapboxLanguage from '@mapbox/mapbox-gl-language';
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import Map, { Layer, Source, FullscreenControl, NavigationControl, MapRef } from 'react-map-gl';
import useActivities from '@/hooks/useActivities';
import {
  MAP_LAYER_LIST,
  IS_CHINESE,
  ROAD_LABEL_DISPLAY,
  MAPBOX_TOKEN,
  USE_DASH_LINE,
  LINE_OPACITY,
  MAP_HEIGHT,
} from '@/utils/const';
import { Coordinate, IViewState, geoJsonForMap, colorFromType, formatRunTime, formatSpeedOrPace } from '@/utils/utils';
import RunMarker from './RunMarker';
import styles from './style.module.scss';
import { FeatureCollection } from 'geojson';
import { RPGeometry } from '@/static/run_countries';
import './mapbox.css';

interface IRunMapProps {
  title: string;
  viewState: IViewState;
  setViewState: (_viewState: IViewState) => void;
  changeYear: (_year: string) => void;
  geoData: FeatureCollection<RPGeometry>;
  thisYear: string;
}

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide']);

const calculateBearing = (start: number[], end: number[]) => {
  const PI = Math.PI;
  const lat1 = (start[1] * PI) / 180;
  const lon1 = (start[0] * PI) / 180;
  const lat2 = (end[1] * PI) / 180;
  const lon2 = (end[0] * PI) / 180;
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / PI + 360) % 360;
};

const getCoreBounds = (features: any[]) => {
  const allCoords = features
    .flatMap(f => f.geometry.coordinates as Coordinate[])
    .filter(p => p && p[0] > 70 && p[0] < 140 && p[1] > 10 && p[1] < 60);

  if (allCoords.length === 0) return null;

  const lons = allCoords.map(p => p[0]).sort((a, b) => a - b);
  const lats = allCoords.map(p => p[1]).sort((a, b) => a - b);
  const medianLon = lons[Math.floor(lons.length / 2)];
  const medianLat = lats[Math.floor(lats.length / 2)];

  const coreCoords = allCoords.filter(
    p => Math.abs(p[0] - medianLon) < 0.3 && Math.abs(p[1] - medianLat) < 0.3
  );

  const finalCoords = coreCoords.length > 0 ? coreCoords : allCoords;
  return [
    [Math.min(...finalCoords.map(p => p[0])), Math.min(...finalCoords.map(p => p[1]))],
    [Math.max(...finalCoords.map(p => p[0])), Math.max(...finalCoords.map(p => p[1]))]
  ] as [[number, number], [number, number]];
};


const RunMap = ({ title, viewState, setViewState, changeYear, geoData, thisYear }: IRunMapProps) => {
  const { runs, activities, countries, provinces } = useActivities() as any;
  const allRuns = runs || activities || []; 
  
  const mapRef = useRef<MapRef>();
  const [animationProgress, setAnimationProgress] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);

  const isSingleRun = geoData.features.length === 1 && geoData.features[0].geometry.coordinates.length;
  const isBigMap = (viewState.zoom ?? 0) <= 3;

  // 🌟 修复后的核心数据获取逻辑
  const runStats = useMemo(() => {
    if (!isSingleRun || !geoData || !geoData.features.length) return null;

    const feature = geoData.features[0];
    const points = feature.geometry.coordinates as Coordinate[];
    if (!points || points.length === 0) return null;

    const runProps = feature.properties as any;
    const targetId = runProps?.run_id || feature?.id;

    let fullRun: any = null;

    // 🌟 致命 Bug 修复处：加上安全校验，拒绝 String(undefined) 的弱智匹配！
    if (targetId !== undefined && targetId !== null) {
      fullRun = allRuns.find((r: any) => String(r.run_id) === String(targetId) || String(r.id) === String(targetId));
    }
    
    // 如果没有 id，退而求其次用时间匹配
    if (!fullRun && runProps?.start_date_local) {
      fullRun = allRuns.find((r: any) => r.start_date_local === runProps.start_date_local);
    }

    const type = fullRun?.type ?? runProps?.type ?? 'Run';
    const averageSpeed = fullRun?.average_speed ?? runProps?.average_speed;
    const movingTime = fullRun?.moving_time ?? runProps?.moving_time;

    return {
      name: runProps?.name || '',
      startLon: points[0][0],
      startLat: points[0][1],
      endLon: points[points.length - 1][0],
      endLat: points[points.length - 1][1],
      distance: fullRun?.distance ?? runProps?.distance ?? 0,
      runTimeStr: movingTime ? formatRunTime(movingTime) : '--:--',
      paceParts: averageSpeed ? formatSpeedOrPace(averageSpeed, type) : null,
      heartRate: fullRun?.average_heartrate ?? runProps?.average_heartrate,
      displayDate: (fullRun?.start_date_local || runProps?.start_date_local || '').slice(0, 10),
      isRide: RIDE_TYPES.has(type),
      runColor: colorFromType(type) || runProps?.color || '#32D74B'
    };
  }, [isSingleRun, geoData, allRuns]);


  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;
    map.stop();

    if (geoData && geoData.features && geoData.features.length === 1) {
      const points = geoData.features[0].geometry.coordinates as Coordinate[];
      const totalPoints = points.length;
      if (totalPoints < 2) return;

      let current = 0;
      let animationFrameId: number;
      let isAnimating = true;

      const startBearing = calculateBearing(points[0], points[Math.min(5, totalPoints - 1)]);
      let currentBearing = startBearing; 

      map.flyTo({
        center: points[0] as [number, number],
        bearing: startBearing,
        pitch: 70,    
        zoom: 16,   
        duration: 2500, 
        essential: true
      });

      const animate = () => {
        if (!isAnimating) return;

        let step = totalPoints / 1500;
        if (step > 0.3) step = 0.3;
        if (step < 0.06) step = 0.06;

        current += step;
        if (current < totalPoints - 1) {
          setAnimationProgress(current);

          const idx = Math.floor(current);
          const remainder = current - idx;
          const p1 = points[idx];
          const p2 = points[idx + 1];
          const lng = p1[0] + (p2[0] - p1[0]) * remainder;
          const lat = p1[1] + (p2[1] - p1[1]) * remainder;

          const lookAheadIdx = Math.min(idx + Math.floor(totalPoints / 15) + 1, totalPoints - 1);
          const targetBearing = calculateBearing([lng, lat], points[lookAheadIdx]);
          
          let diff = targetBearing - currentBearing;
          diff = ((diff + 540) % 360) - 180; 
          currentBearing += diff * 0.05; 

          map.easeTo({
            center: [lng, lat],
            bearing: currentBearing,
            pitch: 70,   
            zoom: 16,
            duration: 32, 
            easing: (t) => t
          });

          animationFrameId = requestAnimationFrame(animate);
        } else {
          setAnimationProgress(totalPoints); 
          setTimeout(() => {
            if (!isAnimating) return;
            const bounds = [
              [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))],
              [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]
            ] as [[number, number], [number, number]];

            map.fitBounds(bounds, { padding: 60, pitch: 0, bearing: 0, duration: 3000 });
          }, 1000); 
        }
      };

      setTimeout(() => {
        if (isAnimating) animationFrameId = requestAnimationFrame(animate);
      }, 2600);

      return () => {
        isAnimating = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (mapRef.current) mapRef.current.getMap()?.stop();
      };
    } else {
      setAnimationProgress(0);
      const bounds = getCoreBounds(geoData?.features || []);

      if (bounds) {
        const cam = map.cameraForBounds(bounds, { padding: 60 });
        if (cam) {
          map.easeTo({ 
            center: cam.center, 
            zoom: (cam.zoom || 10) - 0.2, 
            pitch: 0,      
            bearing: 0,    
            duration: 2000, 
            easing: t => t * (2 - t), 
            essential: true 
          });
        }
      } else if (map.getPitch() > 0 || map.getBearing() !== 0) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 }); 
      }
    }
  }, [geoData, mapLoaded]); 

  const displayData = useMemo(() => {
    if (geoData && geoData.features.length === 1 && animationProgress > 0) {
      const feature = geoData.features[0];
      const points = feature.geometry.coordinates as Coordinate[];
      const idx = Math.floor(animationProgress);
      const remainder = animationProgress - idx;
      const coords = points.slice(0, idx + 1);

      if (idx < points.length - 1 && remainder > 0) {
        const p1 = points[idx];
        const p2 = points[idx + 1];
        coords.push([p1[0] + (p2[0] - p1[0]) * remainder, p1[1] + (p2[1] - p1[1]) * remainder]);
      }

      return { ...geoData, features: [{ ...feature, geometry: { ...feature.geometry, coordinates: coords } }] };
    }
    return geoData; 
  }, [geoData, animationProgress]);

  const mapRefCallback = useCallback((ref: MapRef) => {
    if (ref !== null) {
      const map = ref.getMap();
      if (map && IS_CHINESE) map.addControl(new MapboxLanguage({ defaultLanguage: 'zh-Hans' }));
      map.on('style.load', () => {
        if (!ROAD_LABEL_DISPLAY) {
          MAP_LAYER_LIST.forEach(layerId => { if (map.getLayer(layerId)) map.removeLayer(layerId); });
        }
        mapRef.current = ref;
        setMapLoaded(true); 
      });
      if (map.isStyleLoaded()) {
        mapRef.current = ref;
        setMapLoaded(true);
      }
    }
  }, []);

  const initGeoDataLength = geoData.features.length;
  if (isBigMap && IS_CHINESE) {
    if(geoData.features.length === initGeoDataLength){
      geoData = { "type": "FeatureCollection", "features": geoData.features.concat(geoJsonForMap().features) };
    }
  }

  const dash = USE_DASH_LINE && !isSingleRun && !isBigMap ? [2, 2] : [2, 0];
  const onMove = React.useCallback(({ viewState }: { viewState: IViewState }) => setViewState(viewState), []);

  return (
    <Map
      {...viewState}
      onMove={onMove}
      style={{ width: '100%', height: MAP_HEIGHT }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      ref={mapRefCallback}
      mapboxAccessToken={MAPBOX_TOKEN}
      logoPosition="bottom-right"
      attributionControl={false} 
      fog={{ range: [0.8, 3.5], color: "#151516", "horizon-blend": 0.15, "star-intensity": 0.2 }}
      terrain={isSingleRun ? { source: 'mapbox-dem', exaggeration: 2.5 } : undefined}
    >
      <Layer
        id="3d-buildings"
        source="composite"
        source-layer="building"
        filter={['==', 'extrude', 'true']}
        type="fill-extrusion"
        minzoom={14}
        paint={{
          'fill-extrusion-color': '#1C1C1E', 
          'fill-extrusion-height': ['*', ['get', 'height'], 4.0],
          'fill-extrusion-base': ['*', ['get', 'min_height'], 4.0],
          'fill-extrusion-opacity': 0.85,
        }}
      />
      <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
      <Source id="data" type="geojson" data={displayData}>
        <Layer
          id="runs2"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': isSingleRun ? 5 : (isBigMap ? 1 : 2),
            'line-dasharray': dash,
            'line-opacity': isSingleRun || isBigMap ? 1 : LINE_OPACITY,
            'line-blur': 1,
          }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
      </Source>

      {isSingleRun && runStats && (
        <RunMarker startLat={runStats.startLat} startLon={runStats.startLon} endLat={runStats.endLat} endLon={runStats.endLon} />
      )}
      
      <FullscreenControl position="top-left" />
      <NavigationControl showCompass={false} position="bottom-left" />

      {isSingleRun && runStats && (
        <div className={styles.runDetailCard}>
          <div className={styles.detailName}>
            <span>{runStats.name}</span>
            {runStats.displayDate && <span className={styles.detailDate}>{runStats.displayDate}</span>}
          </div>
          <div className={styles.detailStatsRow}>
            <div className={styles.detailStatBlock}>
              <span className={styles.statLabel}>里程</span>
              <span className={styles.statVal} style={{ color: runStats.runColor }}>
                {(runStats.distance / 1000).toFixed(2)}<small>km</small>
              </span>
            </div>
            <div className={styles.detailStatBlock}>
              <span className={styles.statLabel}>用时</span>
              <span className={styles.statVal}>{runStats.runTimeStr}</span>
            </div>
            <div className={styles.detailStatBlock}>
              <span className={styles.statLabel}>{runStats.isRide ? '均速' : '配速'}</span>
              <span className={styles.statVal}>
                {runStats.paceParts ? (
                  Array.isArray(runStats.paceParts) ? (
                    <>{runStats.paceParts[0]}<small>{runStats.paceParts[1]}</small></>
                  ) : (
                    typeof runStats.paceParts === 'string' && runStats.paceParts.includes('km/h') ? (
                      <>{runStats.paceParts.replace(/km\/h/i, '').trim()}<small>km/h</small></>
                    ) : (runStats.paceParts.replace(' ', ''))
                  )
                ) : ("-'-''")}
              </span>
            </div>
            <div className={styles.detailStatBlock}>
              <span className={styles.statLabel}>心率</span>
              <span className={styles.statVal}>{runStats.heartRate ? Math.round(runStats.heartRate) : '--'}</span>
            </div>
          </div>
        </div>
      )}
    </Map>
  );
};

export default RunMap;