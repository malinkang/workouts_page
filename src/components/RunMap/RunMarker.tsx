import { ReactComponent as EndSvg } from '@assets/end.svg';
import { ReactComponent as StartSvg } from '@assets/start.svg';
import { Marker } from 'react-map-gl';
import styles from './style.module.scss';

interface IRunMarkerProperties {
  startLon: number;
  startLat: number;
  endLon: number;
  endLat: number;
}

const RunMarker = ({
  startLon,
  startLat,
  endLon,
  endLat,
}: IRunMarkerProperties) => {
  return (
    <>
      <Marker
        key="marker_start"
        longitude={startLon}
        latitude={startLat}
        anchor="bottom"
        pitchAlignment="viewport"
      >
        <div className={`${styles.endpointMarker} ${styles.endpointStart}`} aria-label="起点">
          <StartSvg className={styles.locationSVG} />
        </div>
      </Marker>
      <Marker key="marker_end" longitude={endLon} latitude={endLat} anchor="bottom">
        <div className={`${styles.endpointMarker} ${styles.endpointEnd}`} aria-label="终点">
          <EndSvg className={styles.locationSVG} />
        </div>
      </Marker>
    </>
  );
};

export default RunMarker;
