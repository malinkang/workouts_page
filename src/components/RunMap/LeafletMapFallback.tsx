import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import type { FeatureCollection, LineString } from 'geojson';
import styles from './style.module.scss';
import 'leaflet/dist/leaflet.css';

interface LeafletMapFallbackProps {
  geoData: FeatureCollection<LineString>;
  title: string;
  isSingleRun: boolean;
}

interface RouteData {
  points: LatLngExpression[];
  color: string;
}

const DEFAULT_CENTER: LatLngExpression = [35, 110];
const DEFAULT_ZOOM = 4;

const getRoutes = (geoData: FeatureCollection<LineString>): RouteData[] =>
  geoData.features
    .map((feature) => ({
      points: feature.geometry.coordinates
        .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))
        .map(([longitude, latitude]) => [latitude, longitude] as LatLngExpression),
      color: String(feature.properties?.color || '#32D74B'),
    }))
    .filter((route) => route.points.length > 1);

const boundsForRoutes = (routes: RouteData[]): LatLngBoundsExpression | null => {
  const points = routes.flatMap((route) => route.points as Array<[number, number]>);
  if (!points.length) return null;

  let minLat = points[0][0];
  let minLon = points[0][1];
  let maxLat = points[0][0];
  let maxLon = points[0][1];

  points.slice(1).forEach(([latitude, longitude]) => {
    minLat = Math.min(minLat, latitude);
    minLon = Math.min(minLon, longitude);
    maxLat = Math.max(maxLat, latitude);
    maxLon = Math.max(maxLon, longitude);
  });

  // Leaflet cannot fit a zero-size extent, which is common for very short tracks.
  const latPadding = Math.max((maxLat - minLat) * 0.04, 0.002);
  const lonPadding = Math.max((maxLon - minLon) * 0.04, 0.002);
  return [
    [minLat - latPadding, minLon - lonPadding],
    [maxLat + latPadding, maxLon + lonPadding],
  ];
};

const FitRoutes = ({ bounds }: { bounds: LatLngBoundsExpression | null }) => {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16, animate: false });
  }, [bounds, map]);

  return null;
};

const FullscreenButton = () => {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === map.getContainer());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [map]);

  const toggleFullscreen = () => {
    const container = map.getContainer();
    if (document.fullscreenElement === container) {
      void document.exitFullscreen?.();
      return;
    }
    void container.requestFullscreen?.();
  };

  return (
    <button
      type="button"
      className={styles.leafletFullscreenButton}
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? '退出全屏地图' : '全屏显示地图'}
      title={isFullscreen ? '退出全屏' : '全屏'}
    >
      {isFullscreen ? '⤢' : '⛶'}
    </button>
  );
};

const LeafletMapFallback = ({ geoData, title, isSingleRun }: LeafletMapFallbackProps) => {
  const routes = useMemo(() => getRoutes(geoData), [geoData]);
  const bounds = useMemo(() => boundsForRoutes(routes), [routes]);
  const firstRoute = routes[0];
  const startPoint = firstRoute?.points[0];
  const endPoint = firstRoute?.points[firstRoute.points.length - 1];

  return (
    <div className={styles.leafletFallback}>
      <MapContainer
        className={styles.leafletMap}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl
        scrollWheelZoom
        doubleClickZoom
        dragging
        touchZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitRoutes bounds={bounds} />
        <FullscreenButton />
        {routes.map((route, index) => (
          <Polyline
            key={`${index}-${route.points.length}`}
            positions={route.points}
            pathOptions={{ color: route.color, opacity: isSingleRun ? 0.96 : 0.72, weight: isSingleRun ? 5 : 2 }}
          />
        ))}
        {isSingleRun && startPoint && (
          <CircleMarker
            center={startPoint}
            radius={8}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#20c463', fillOpacity: 1 }}
          />
        )}
        {isSingleRun && endPoint && (
          <CircleMarker
            center={endPoint}
            radius={8}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#e64c3c', fillOpacity: 1 }}
          />
        )}
        {!isSingleRun && title && <div className={styles.leafletTitle}>{title}</div>}
      </MapContainer>
    </div>
  );
};

export default LeafletMapFallback;
