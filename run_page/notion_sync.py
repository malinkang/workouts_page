import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo

import gpxpy
import httpx
import polyline
from config import BASE_TIMEZONE, JSON_FILE, MAPPING_TYPE

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_API_VERSION = os.getenv("NOTION_API_VERSION", "2022-06-28")

PROPERTY_CANDIDATES = {
    "title": ["标题", "Name", "名字", "名称"],
    "id": ["Id", "ID", "id"],
    "distance": ["距离", "Distance", "distance"],
    "duration": ["运动时长", "Duration", "duration"],
    "avg_hr": ["平均心率", "Average Heart Rate", "average_heartrate"],
    "start": ["开始时间", "Start", "start_date_local"],
    "end": ["结束时间", "End", "end"],
    "type_relation": ["运动类型", "类型", "Type", "type"],
    "gpx": ["gpx", "GPX", "轨迹", "路线"],
    "location": ["位置", "地点", "Location", "location_country", "region"],
}

TYPE_ALIASES = {
    "run": "Run",
    "running": "Run",
    "跑步": "Run",
    "ride": "Ride",
    "cycling": "Ride",
    "骑行": "Ride",
    "walk": "Walk",
    "walking": "Walk",
    "步行": "Walk",
    "hike": "Hike",
    "hiking": "Hike",
    "徒步": "Hike",
    "登山": "Hike",
    "swim": "Swim",
    "swimming": "Swim",
    "游泳": "Swim",
    "rowing": "Rowing",
    "划船": "Rowing",
    "virtualrun": "VirtualRun",
    "虚拟跑": "VirtualRun",
    "treadmill": "Treadmill",
    "跑步机": "Treadmill",
    "virtualride": "VirtualRide",
    "虚拟骑行": "VirtualRide",
    "ski": "Ski",
    "滑雪": "Ski",
    "snowboard": "Snowboard",
    "单板": "Snowboard",
    "kayaking": "Kayaking",
    "皮划艇": "Kayaking",
    "roadtrip": "RoadTrip",
    "自驾": "RoadTrip",
}


def get_env(name: str, required: bool = True) -> Optional[str]:
    value = os.getenv(name)
    if required and not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def notion_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {get_env('NOTION_TOKEN')}",
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
    }


def extract_plain_text(prop: Optional[dict]) -> str:
    if not prop:
        return ""
    prop_type = prop.get("type")
    if prop_type in {"title", "rich_text"}:
        return "".join(item.get("plain_text", "") for item in prop.get(prop_type, []))
    if prop_type == "select":
        return prop.get("select", {}).get("name", "")
    if prop_type == "status":
        return prop.get("status", {}).get("name", "")
    if prop_type == "url":
        return prop.get("url", "") or ""
    if prop_type == "number":
        value = prop.get("number")
        return "" if value is None else str(value)
    return ""


def extract_number(prop: Optional[dict]) -> Optional[float]:
    if not prop:
        return None
    prop_type = prop.get("type")
    if prop_type == "number":
        return prop.get("number")
    if prop_type == "formula":
        formula = prop.get("formula", {})
        if formula.get("type") == "number":
            return formula.get("number")
        if formula.get("type") == "string":
            text = formula.get("string") or ""
            try:
                return float(text)
            except ValueError:
                return None
    text = extract_plain_text(prop).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def extract_date(prop: Optional[dict], local_tz: ZoneInfo) -> Optional[datetime]:
    if not prop or prop.get("type") != "date":
        return None
    value = prop.get("date", {}).get("start")
    if not value:
        return None
    value = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=local_tz)
    return dt


def extract_relation_ids(prop: Optional[dict]) -> List[str]:
    if not prop or prop.get("type") != "relation":
        return []
    return [item.get("id") for item in prop.get("relation", []) if item.get("id")]


def extract_file_urls(prop: Optional[dict]) -> List[str]:
    if not prop or prop.get("type") != "files":
        return []
    urls: List[str] = []
    for item in prop.get("files", []):
        item_type = item.get("type")
        if item_type == "external":
            url = item.get("external", {}).get("url")
        elif item_type == "file":
            url = item.get("file", {}).get("url")
        else:
            url = None
        if url:
            urls.append(url)
    return urls


def pick_property(
    properties: Dict[str, dict], key: str, prop_type: Optional[str] = None
) -> Optional[dict]:
    for name in PROPERTY_CANDIDATES.get(key, []):
        prop = properties.get(name)
        if prop and (prop_type is None or prop.get("type") == prop_type):
            return prop
    if prop_type is None:
        return None
    for prop in properties.values():
        if prop.get("type") == prop_type:
            return prop
    return None


def parse_run_id(raw_value: str) -> Optional[int]:
    value = raw_value.strip()
    if not value:
        return None
    if value.isdigit():
        return int(value)
    for part in value.split("_"):
        if part.isdigit():
            return int(part)
    digits = "".join(ch for ch in value if ch.isdigit())
    if 8 <= len(digits) <= 19:
        return int(digits)
    return None


def map_type_name(name: str) -> Optional[str]:
    if not name:
        return None
    compact = name.strip()
    lowered = compact.lower().replace(" ", "")
    if lowered in TYPE_ALIASES:
        return TYPE_ALIASES[lowered]
    if compact in TYPE_ALIASES:
        return TYPE_ALIASES[compact]

    fuzzy_rules = [
        ("虚拟骑", "VirtualRide"),
        ("virtualride", "VirtualRide"),
        ("虚拟跑", "VirtualRun"),
        ("virtualrun", "VirtualRun"),
        ("跑步机", "Treadmill"),
        ("treadmill", "Treadmill"),
        ("骑", "Ride"),
        ("cycling", "Ride"),
        ("ride", "Ride"),
        ("徒步", "Hike"),
        ("登山", "Hike"),
        ("hike", "Hike"),
        ("swim", "Swim"),
        ("游泳", "Swim"),
        ("划船", "Rowing"),
        ("rowing", "Rowing"),
        ("步行", "Walk"),
        ("walk", "Walk"),
        ("跑", "Run"),
        ("run", "Run"),
    ]
    for needle, mapped in fuzzy_rules:
        if needle in lowered or needle in compact:
            return mapped
    return None


def resolve_type(
    relation_ids: Iterable[str], type_name_by_id: Dict[str, str], title: str
) -> str:
    for relation_id in relation_ids:
        mapped = map_type_name(type_name_by_id.get(relation_id, ""))
        if mapped:
            return mapped
    inferred = map_type_name(title)
    return inferred or "Run"


def fetch_database_pages(client: httpx.Client, database_id: str) -> List[dict]:
    pages: List[dict] = []
    next_cursor = None
    while True:
        payload = {"page_size": 100}
        if next_cursor:
            payload["start_cursor"] = next_cursor
        response = client.post(
            f"{NOTION_API_BASE}/databases/{database_id}/query",
            headers=notion_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        pages.extend(data.get("results", []))
        if not data.get("has_more"):
            return pages
        next_cursor = data.get("next_cursor")


def build_type_map(
    client: httpx.Client, type_database_id: Optional[str]
) -> Dict[str, str]:
    if not type_database_id:
        return {}
    result: Dict[str, str] = {}
    for page in fetch_database_pages(client, type_database_id):
        if page.get("archived") or page.get("in_trash"):
            continue
        properties = page.get("properties", {})
        title_prop = pick_property(properties, "title", "title")
        fallback_prop = pick_property(properties, "title")
        name = extract_plain_text(title_prop or fallback_prop)
        if name:
            result[page["id"]] = name
    return result


def load_route_from_gpx(
    client: httpx.Client, urls: List[str]
) -> Tuple[str, Optional[Tuple[float, float]]]:
    for url in urls:
        try:
            response = client.get(url)
            response.raise_for_status()
            gpx = gpxpy.parse(response.text)
        except Exception:
            continue

        coords: List[Tuple[float, float]] = []
        for track in gpx.tracks:
            for segment in track.segments:
                for point in segment.points:
                    coords.append((point.latitude, point.longitude))

        if not coords and gpx.routes:
            for route in gpx.routes:
                for point in route.points:
                    coords.append((point.latitude, point.longitude))

        if not coords:
            continue

        return polyline.encode(coords), coords[0]

    return "", None


def page_to_activity(
    client: httpx.Client, page: dict, type_name_by_id: Dict[str, str], local_tz: ZoneInfo
) -> Optional[dict]:
    if page.get("archived") or page.get("in_trash"):
        return None

    properties = page.get("properties", {})
    run_id_prop = pick_property(properties, "id")
    run_id = parse_run_id(extract_plain_text(run_id_prop))
    if run_id is None:
        return None

    title_prop = pick_property(properties, "title", "title")
    title = extract_plain_text(title_prop)
    if not title:
        title = extract_plain_text(pick_property(properties, "title"))
    if not title:
        title = f"Workout {run_id}"

    distance = float(extract_number(pick_property(properties, "distance")) or 0)
    duration_seconds = int(extract_number(pick_property(properties, "duration")) or 0)
    if distance <= 0 and duration_seconds <= 0:
        return None

    start_value = extract_date(pick_property(properties, "start", "date"), local_tz)
    end_value = extract_date(pick_property(properties, "end", "date"), local_tz)
    if start_value is None and end_value is not None and duration_seconds > 0:
        start_value = end_value - timedelta(seconds=duration_seconds)
    if end_value is None and start_value is not None and duration_seconds > 0:
        end_value = start_value + timedelta(seconds=duration_seconds)
    if start_value is None:
        start_value = datetime.now(tz=local_tz)
    if end_value is None:
        end_value = start_value + timedelta(seconds=duration_seconds)

    start_local = start_value.astimezone(local_tz)
    start_utc = start_value.astimezone(timezone.utc)
    end_local = end_value.astimezone(local_tz)
    end_utc = end_value.astimezone(timezone.utc)

    type_relation_ids = extract_relation_ids(
        pick_property(properties, "type_relation", "relation")
    )
    workout_type = resolve_type(type_relation_ids, type_name_by_id, title)

    location_country = extract_plain_text(pick_property(properties, "location"))
    average_heartrate = extract_number(pick_property(properties, "avg_hr"))

    summary_polyline, first_point = load_route_from_gpx(
        client, extract_file_urls(pick_property(properties, "gpx", "files"))
    )

    return {
        "run_id": run_id,
        "name": title,
        "type": workout_type,
        "start_date": start_utc.strftime("%Y-%m-%d %H:%M:%S+00:00"),
        "start_date_local": start_local.strftime("%Y-%m-%d %H:%M:%S"),
        "distance": distance,
        "moving_time": str(timedelta(seconds=max(duration_seconds, 0))),
        "average_heartrate": average_heartrate,
        "average_speed": (distance / duration_seconds) if duration_seconds > 0 else 0,
        "location_country": location_country,
        "summary_polyline": summary_polyline,
        "source": "notion",
        "_start_date": start_local.date(),
    }


def apply_streaks(activities: List[dict]) -> List[dict]:
    streak = 0
    last_date = None
    for activity in activities:
        current_date = activity["_start_date"]
        if last_date is None:
            streak = 1
        elif current_date == last_date:
            pass
        elif current_date == last_date + timedelta(days=1):
            streak += 1
        else:
            streak = 1
        activity["streak"] = streak
        last_date = current_date
    return activities


def write_activities_json(activities: List[dict]) -> int:
    activities = [
        activity
        for activity in activities
        if activity["type"] in MAPPING_TYPE and activity["distance"] > 0
    ]
    activities.sort(key=lambda item: item["start_date_local"])
    apply_streaks(activities)
    for activity in activities:
        activity.pop("_start_date", None)
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(activities, f, ensure_ascii=False, indent=2)
    return len(activities)


def sync_from_notion(reset_db: bool = True) -> int:
    workout_database_id = get_env("WORKOUT_DATABASE_ID")
    type_database_id = os.getenv("TYPE_DATABASE_ID")
    local_tz = ZoneInfo(os.getenv("WORKOUTS_PAGE_TIMEZONE", BASE_TIMEZONE))

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        type_name_by_id = build_type_map(client, type_database_id)
        pages = fetch_database_pages(client, workout_database_id)
        activities = [
            activity
            for activity in (
                page_to_activity(client, page, type_name_by_id, local_tz)
                for page in pages
            )
            if activity is not None
        ]

    return write_activities_json(activities)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync workouts_page activities.json from a Notion workout database."
    )
    parser.add_argument(
        "--preserve-existing",
        action="store_true",
        help="Deprecated compatibility flag. Existing activity JSON is always regenerated.",
    )
    args = parser.parse_args()

    activity_count = sync_from_notion(reset_db=not args.preserve_existing)
    print(f"Synced {activity_count} activities from Notion.")


if __name__ == "__main__":
    main()
