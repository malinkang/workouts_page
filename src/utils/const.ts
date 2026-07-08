// const
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const MUNICIPALITY_CITIES_ARR = [
  '北京市',
  '上海市',
  '天津市',
  '重庆市',
  '香港特别行政区',
  '澳门特别行政区',
];

const USE_GOOGLE_ANALYTICS = false;
const GOOGLE_ANALYTICS_TRACKING_ID = '';

// styling: set to `true` if you want dash-line route
const USE_DASH_LINE = false;
// styling: route line opacity: [0, 1]
const LINE_OPACITY = 0.8;
// styling: map height
const MAP_HEIGHT = 800;
//set to `true` if you want to display only the routes without showing the map.
const PRIVACY_MODE = false;
//set to `false` if you want to make light off as default, only effect when `PRIVACY_MODE` = false
const LIGHTS_ON = true;

// IF you outside China please make sure IS_CHINESE = false
const IS_CHINESE = true;
const USE_ANIMATION_FOR_GRID = false;
const CHINESE_INFO_MESSAGE = (yearLength: number, year: string): string =>
  `自己的体重导致双脚变得沉重越来越扛不住它，体检数据也一年比一年难看，是时候该动起来了。锻炼开始第 ${yearLength} 年 ` + ( year === 'Total' ? '' : `，地图展示的是 ${year} 年轨迹热图。`);

const ENGLISH_INFO_MESSAGE = (yearLength: number, year: string): string =>
  `Logged ${yearLength} Years of Outdoor Journey` +  ( year === 'Total' ? '' : `, the map show routes in ${year}`);

// not support English for now
const CHINESE_LOCATION_INFO_MESSAGE_FIRST =
  '我去过了一些地方，希望随着时间推移，地图点亮的地方越来越多';
const CHINESE_LOCATION_INFO_MESSAGE_SECOND = '不要停下来，不要停下探索的脚步';

const INFO_MESSAGE = IS_CHINESE ? CHINESE_INFO_MESSAGE : ENGLISH_INFO_MESSAGE;
const FULL_MARATHON_RUN_TITLE = IS_CHINESE ? '全程马拉松' : 'Full Marathon';
const HALF_MARATHON_RUN_TITLE = IS_CHINESE ? '半程马拉松' : 'Half Marathon';
const RUN_TITLE = IS_CHINESE ? '跑步' : 'Run';
const TRAIL_RUN_TITLE = IS_CHINESE ? '越野跑' : 'Trail Run';
const SWIM_TITLE = IS_CHINESE ? '游泳' : 'Swim';

const RIDE_TITLE = IS_CHINESE ? '骑行' : 'Ride';
const INDOOR_RIDE_TITLE = IS_CHINESE ? '室内骑行' : 'Indoor Ride';
const VIRTUAL_RIDE_TITLE = IS_CHINESE ? '虚拟骑行' : 'Virtual Ride';
const HIKE_TITLE = IS_CHINESE ? '徒步' : 'Hike';
const ROWING_TITLE = IS_CHINESE ? '划船' : 'Rowing';
const KAYAKING_TITLE = IS_CHINESE ? '皮划艇' : 'Kayaking';
const SNOWBOARD_TITLE = IS_CHINESE ? '单板滑雪' : 'Snowboard';
const SKI_TITLE = IS_CHINESE ? '双板滑雪' : 'Ski';
const ROAD_TRIP_TITLE = IS_CHINESE ? '自驾' : 'RoadTrip';
const FLIGHT_TITLE = IS_CHINESE ? '飞行' : 'Flight';

// 🌟 新增：跑走相关类型翻译
const WALK_TITLE = IS_CHINESE ? '健走' : 'Walk';
const VIRTUAL_RUN_TITLE = IS_CHINESE ? '虚拟跑' : 'Virtual Run';
const TREADMILL_TITLE = IS_CHINESE ? '跑步机' : 'Treadmill';

const RUN_TITLES = {
  FULL_MARATHON_RUN_TITLE,
  HALF_MARATHON_RUN_TITLE,
  RUN_TITLE,
  TRAIL_RUN_TITLE,
  
  // 🌟 将新增的翻译加入字典
  WALK_TITLE,
  VIRTUAL_RUN_TITLE,
  TREADMILL_TITLE,

  RIDE_TITLE,
  INDOOR_RIDE_TITLE,
  VIRTUAL_RIDE_TITLE,
  HIKE_TITLE,
  ROWING_TITLE,
  KAYAKING_TITLE,
  SWIM_TITLE,
  ROAD_TRIP_TITLE,
  FLIGHT_TITLE,
  SNOWBOARD_TITLE,
  SKI_TITLE,
};

export {
  USE_GOOGLE_ANALYTICS,
  GOOGLE_ANALYTICS_TRACKING_ID,
  CHINESE_LOCATION_INFO_MESSAGE_FIRST,
  CHINESE_LOCATION_INFO_MESSAGE_SECOND,
  MAPBOX_TOKEN,
  MUNICIPALITY_CITIES_ARR,
  IS_CHINESE,
  INFO_MESSAGE,
  RUN_TITLES,
  USE_ANIMATION_FOR_GRID,
  USE_DASH_LINE,
  LINE_OPACITY,
  MAP_HEIGHT,
  PRIVACY_MODE,
  LIGHTS_ON,
};

const nike = 'rgb(224,237,94)';
const yellow = 'rgb(224,237,94)';
const green = 'rgb(0,237,94)';
const pink = 'rgb(237,85,219)';
const cyan = 'rgb(112,243,255)';
const IKB = 'rgb(0,47,167)';
const wpink = 'rgb(228,212,220)';
const gold = 'rgb(0, 199, 255)';
const purple = 'rgb(154,118,252)';
const veryPeri = 'rgb(105,106,173)';//长春花蓝
const red = 'rgb(255,0,0)';//大红色

// If your map has an offset please change this line
// issues #92 and #198
export const NEED_FIX_MAP = false;
export const MAIN_COLOR = green;
export const RUN_COLOR = yellow;
export const RIDE_COLOR = green;
export const VIRTUAL_RIDE_COLOR = veryPeri;
export const HIKE_COLOR = pink;
export const SWIM_COLOR = gold;
export const ROWING_COLOR = cyan;
export const ROAD_TRIP_COLOR = purple;
export const FLIGHT_COLOR = wpink;
export const PROVINCE_FILL_COLOR = '#47b8e0';
export const COUNTRY_FILL_COLOR = wpink;
export const KAYAKING_COLOR = red;
export const SNOWBOARD_COLOR = wpink;
export const TRAIL_RUN_COLOR = IKB;

// 🌟 新增：为跑走类型分配极客颜色
export const WALK_COLOR = pink;
export const VIRTUAL_RUN_COLOR = veryPeri;
export const TREADMILL_COLOR = cyan;
