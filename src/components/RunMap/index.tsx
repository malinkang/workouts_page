import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import Map, { Layer, Source, FullscreenControl, NavigationControl, MapRef } from 'react-map-gl';
import useActivities from '@/hooks/useActivities';
import {
  IS_CHINESE,
  MAPBOX_TOKEN,
  USE_DASH_LINE,
  LINE_OPACITY,
  MAP_HEIGHT,
} from '@/utils/const';
import { Activity, Coordinate, geoJsonForMap, colorFromType, formatRunTime, formatSpeedOrPace } from '@/utils/utils';
import RunMarker from './RunMarker';
import styles from './style.module.scss';
import { FeatureCollection } from 'geojson';
import { RPGeometry } from '@/static/run_countries';
import './mapbox.css';

interface IRunMapProps {
  title: string;
  changeYear: (_year: string) => void;
  geoData: FeatureCollection<RPGeometry>;
  thisYear: string;
  isSticky?: boolean; 
}

const RIDE_TYPES = new Set(['Ride', 'Ninebot', 'VirtualRide', 'EBikeRide']);

const formatCoordinate = (lat: number, lon: number) => `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
const LABEL_TEXT_FIELD = ['coalesce', ['get', 'name_zh-Hans'], ['get', 'name_zh-Hant'], ['get', 'name']] as const;

const getThemeMode = () =>
  (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

const getFirstLabelLayerId = (map: any) => {
  const style = map?.getStyle?.();
  const layers = style?.layers || [];
  const firstSymbolLayer = layers.find((layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']);
  return firstSymbolLayer?.id || undefined;
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

const RunMap = ({ title, changeYear, geoData, thisYear, isSticky }: IRunMapProps) => {
  const { runs, activities, countries, provinces } = useActivities() as any;
  const allRuns = runs || activities || []; 
  
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(3);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(getThemeMode);
  const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);

  const isSingleRun = geoData.features.length === 1 && geoData.features[0].geometry.coordinates.length;
  const isBigMap = currentZoom <= 3;

  const initialBounds = useMemo(() => {
    const b = getCoreBounds(geoData?.features || []);
    return b ? b : [[70, 10], [140, 60]] as [[number, number], [number, number]];
  }, []);

  const hasMapboxToken = Boolean(MAPBOX_TOKEN);
  const mapStyleUrl = hasMapboxToken
    ? (themeMode === 'light'
      ? 'mapbox://styles/mapbox/light-v11'
      : 'mapbox://styles/mapbox/dark-v11')
    : 'https://tiles.openfreemap.org/styles/liberty';
  const buildingColor = themeMode === 'light' ? '#d9e1ec' : '#1C1C1E';
  const buildingOpacity = themeMode === 'light' ? 0.55 : 0.85;

  const selectedRun = useMemo<Activity | null>(() => {
    if (!isSingleRun || !geoData || !geoData.features.length) return null;

    const feature = geoData.features[0];
    const runProps = feature.properties as any;
    const targetId = runProps?.run_id || feature?.id;

    if (targetId !== undefined && targetId !== null) {
      const found = allRuns.find((r: any) => String(r.run_id) === String(targetId) || String(r.id) === String(targetId));
      if (found) return found as Activity;
    }

    if (runProps?.start_date_local) {
      const found = allRuns.find((r: any) => r.start_date_local === runProps.start_date_local);
      if (found) return found as Activity;
    }

    return null;
  }, [allRuns, geoData, isSingleRun]);

  const runStats = useMemo(() => {
    if (!isSingleRun || !geoData || !geoData.features.length) return null;

    const feature = geoData.features[0];
    const points = feature.geometry.coordinates as Coordinate[];
    if (!points || points.length === 0) return null;

    const runProps = feature.properties as any;
    const type = selectedRun?.type ?? runProps?.type ?? 'Run';
    const averageSpeed = selectedRun?.average_speed ?? runProps?.average_speed;
    const movingTime = selectedRun?.moving_time ?? runProps?.moving_time;
    const locationParts = [
      (selectedRun as any)?.location_city ?? runProps?.location_city,
      selectedRun?.location_country ?? runProps?.location_country,
    ].filter(Boolean);

    return {
      name: selectedRun?.name || runProps?.name || '',
      startLon: points[0][0],
      startLat: points[0][1],
      endLon: points[points.length - 1][0],
      endLat: points[points.length - 1][1],
      distance: selectedRun?.distance ?? runProps?.distance ?? 0,
      runTimeStr: movingTime ? formatRunTime(movingTime) : '--:--',
      paceParts: averageSpeed ? formatSpeedOrPace(averageSpeed, type) : null,
      heartRate: selectedRun?.average_heartrate ?? runProps?.average_heartrate,
      displayDate: (selectedRun?.start_date_local || runProps?.start_date_local || '').slice(0, 10),
      locationLabel: locationParts.join(' · '),
      startCoordText: formatCoordinate(points[0][1], points[0][0]),
      endCoordText: formatCoordinate(points[points.length - 1][1], points[points.length - 1][0]),
      isRide: RIDE_TYPES.has(type),
      runColor: colorFromType(type) || runProps?.color || '#32D74B',
    };
  }, [geoData, isSingleRun, selectedRun]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map && mapLoaded) {
      map.resize();
      const t1 = setTimeout(() => map.resize(), 100);
      const t2 = setTimeout(() => map.resize(), 300);
      const t3 = setTimeout(() => map.resize(), 600);
      return () => { 
        clearTimeout(t1); 
        clearTimeout(t2); 
        clearTimeout(t3); 
      };
    }
  }, [isSticky, mapLoaded, geoData, thisYear]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;

    map.stop();
    const bounds = getCoreBounds(geoData?.features || []);

    if (bounds) {
      map.fitBounds(bounds, {
        padding: isSingleRun ? 60 : 40,
        pitch: 0,
        bearing: 0,
        duration: 0,
        essential: true,
      });
    } else if (map.getPitch() > 0 || map.getBearing() !== 0) {
      map.jumpTo({ pitch: 0, bearing: 0 });
    }
  }, [geoData, isSingleRun, mapLoaded]); 

  const displayData = useMemo(() => {
    let dataToRender = geoData;

    if (isBigMap && IS_CHINESE && geoData.features.length > 1) {
      dataToRender = {
        type: 'FeatureCollection',
        features: [...geoData.features, ...geoJsonForMap().features]
      } as FeatureCollection<RPGeometry>;
    }

    return dataToRender; 
  }, [geoData, isBigMap]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setThemeMode(getThemeMode());
    });

    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const onMapLoad = useCallback((e: any) => {
    setLabelLayerId(getFirstLabelLayerId(e?.target));
    setMapLoaded(true); 
  }, []);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const syncLabelLayer = () => {
      setLabelLayerId(getFirstLabelLayerId(map));
    };

    map.on('styledata', syncLabelLayer);
    return () => {
      map.off('styledata', syncLabelLayer);
    };
  }, [themeMode]);

  const dash = USE_DASH_LINE && !isSingleRun && !isBigMap ? [2, 2] : [2, 0];

  return (
    <Map
      ref={mapRef}
      onLoad={onMapLoad}
      initialViewState={{ bounds: initialBounds, fitBoundsOptions: { padding: 40 } }}
      onZoom={(e) => setCurrentZoom(e.viewState.zoom)}
      style={{ width: '100%', height: MAP_HEIGHT }}
      mapStyle={mapStyleUrl}
      mapboxAccessToken={MAPBOX_TOKEN || undefined}
      logoPosition="bottom-right"
      attributionControl={false} 
      fog={{ range: [0.8, 3.5], color: "#151516", "horizon-blend": 0.15, "star-intensity": 0.2 }}
      terrain={hasMapboxToken && isSingleRun ? { source: 'mapbox-dem', exaggeration: 2.5 } : undefined}
    >
      {hasMapboxToken && (
        <Layer
          id="3d-buildings"
          beforeId={labelLayerId}
          source="composite"
          source-layer="building"
          filter={['==', 'extrude', 'true']}
          type="fill-extrusion"
          minzoom={14}
          paint={{
            'fill-extrusion-color': buildingColor,
            'fill-extrusion-height': ['*', ['get', 'height'], 4.0],
            'fill-extrusion-base': ['*', ['get', 'min_height'], 4.0],
            'fill-extrusion-opacity': buildingOpacity,
          }}
        />
      )}
      {hasMapboxToken && (
        <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
      )}
      <Source id="data" type="geojson" data={displayData}>
        <Layer
          id="runs2"
          beforeId={labelLayerId}
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
      {hasMapboxToken && (
        <Layer
          id="city-label-overlay"
          source="composite"
          source-layer="place_label"
          type="symbol"
          minzoom={2}
          filter={['match', ['get', 'class'], ['city', 'town', 'village'], true, false]}
          layout={{
            'text-field': LABEL_TEXT_FIELD,
            'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              2, 10,
              4, 12,
              6, 14,
              8, 16
            ],
            'text-letter-spacing': 0.03,
            'text-max-width': 8,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-color': themeMode === 'light' ? 'rgba(22,32,51,0.92)' : 'rgba(255,255,255,0.96)',
            'text-halo-color': themeMode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(12,12,14,0.96)',
            'text-halo-width': 1.8,
          }}
        />
      )}
      {hasMapboxToken && (
        <Layer
          id="region-label-overlay"
          source="composite"
          source-layer="place_label"
          type="symbol"
          minzoom={1}
          filter={['match', ['get', 'class'], ['country', 'state', 'province'], true, false]}
          layout={{
            'text-field': LABEL_TEXT_FIELD,
            'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              1, 11,
              3, 13,
              5, 15,
              7, 18
            ],
            'text-letter-spacing': 0.05,
            'text-transform': 'uppercase',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-color': themeMode === 'light' ? 'rgba(22,32,51,0.86)' : 'rgba(244,244,246,0.9)',
            'text-halo-color': themeMode === 'light' ? 'rgba(255,255,255,0.94)' : 'rgba(12,12,14,0.98)',
            'text-halo-width': 2,
          }}
        />
      )}

      {isSingleRun && runStats && (
        <RunMarker startLat={runStats.startLat} startLon={runStats.startLon} endLat={runStats.endLat} endLon={runStats.endLon} />
      )}

      {!isSingleRun && title && (
        <div className={styles.runTitle}>{title}</div>
      )}
      
      <FullscreenControl position="top-left" />
      <NavigationControl showCompass={false} position="bottom-left" />

    </Map>
  );
};

export default RunMap;
