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
SYNC_OVERLAP_SECONDS = int(os.getenv("NOTION_SYNC_OVERLAP_SECONDS", "300") or "300")

PROPERTY_CANDIDATES = {
    "title": ["标题", "Name", "名字", "名称"],
    "id": ["Id", "ID", "id"],
    "link": ["链接", "Link", "URL", "url"],
    "distance": ["距离", "Distance", "distance"],
    "duration": ["运动时长", "Duration", "duration"],
    "avg_hr": ["平均心率", "Average Heart Rate", "average_heartrate"],
    "max_hr": ["最大心率", "Max Heart Rate", "max_heartrate"],
    "calories": ["消耗热量", "Calories", "calories"],
    "avg_pace": ["平均配速", "Average Pace", "average_pace"],
    "start": ["开始时间", "Start", "start_date_local"],
    "end": ["结束时间", "End", "end"],
    "type_relation": ["运动类型", "类型", "Type", "type"],
    "gpx": ["gpx", "GPX", "轨迹", "路线"],
    "location": ["位置", "地点", "Location", "location_country", "region"],
    "split_index": ["序号", "Split", "split", "序号"],
    "split_relation": ["运动记录", "分段", "Workout", "Activity", "运动"],
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
    "行走": "Walk",
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



def parse_notion_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)



def format_notion_datetime(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")



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
    try:
        normalized = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=local_tz)
    return dt.astimezone(local_tz)



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
        ("行走", "Walk"),
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



def fetch_database_pages(
    client: httpx.Client,
    database_id: str,
    filter_payload: Optional[dict] = None,
) -> List[dict]:
    pages: List[dict] = []
    next_cursor = None
    while True:
        payload: Dict[str, object] = {"page_size": 100}
        if filter_payload:
            payload["filter"] = filter_payload
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



def fetch_page(client: httpx.Client, page_id: str) -> dict:
    response = client.get(
        f"{NOTION_API_BASE}/pages/{page_id}",
        headers=notion_headers(),
    )
    response.raise_for_status()
    return response.json()



def fetch_pages_edited_after(
    client: httpx.Client, database_id: str, after: datetime
) -> List[dict]:
    return fetch_database_pages(
        client,
        database_id,
        {
            "timestamp": "last_edited_time",
            "last_edited_time": {"on_or_after": format_notion_datetime(after)},
        },
    )



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



def extract_run_id_from_page(page: dict) -> Optional[int]:
    properties = page.get("properties", {})
    run_id_prop = pick_property(properties, "id")
    run_id = parse_run_id(extract_plain_text(run_id_prop))
    if run_id is not None:
        return run_id

    link_prop = pick_property(properties, "link", "url")
    run_id = parse_run_id(extract_plain_text(link_prop))
    if run_id is not None:
        return run_id

    fallback_url_prop = pick_property(properties, "link")
    return parse_run_id(extract_plain_text(fallback_url_prop))



def split_page_to_record(page: dict) -> Optional[Tuple[List[str], dict]]:
    if page.get("archived") or page.get("in_trash"):
        return None

    properties = page.get("properties", {})
    relation_ids = extract_relation_ids(pick_property(properties, "split_relation", "relation"))
    if not relation_ids:
        return None

    split_id = extract_plain_text(pick_property(properties, "id"))
    title = extract_plain_text(pick_property(properties, "title", "title"))
    index_value = extract_number(pick_property(properties, "split_index"))
    distance = extract_number(pick_property(properties, "distance")) or 0
    duration = extract_number(pick_property(properties, "duration")) or 0
    avg_hr = extract_number(pick_property(properties, "avg_hr"))
    avg_pace = extract_number(pick_property(properties, "avg_pace"))

    split_record = {
        "notion_page_id": page.get("id"),
        "notion_last_edited_time": page.get("last_edited_time"),
        "split_id": split_id or page.get("id"),
        "name": title or f"Split {int(index_value)}" if index_value is not None else "Split",
        "index": int(index_value) if index_value is not None else None,
        "distance": float(distance),
        "duration": int(duration),
        "average_heartrate": avg_hr,
        "average_pace": avg_pace,
    }
    return relation_ids, split_record



def build_split_map(split_pages: List[dict]) -> Dict[str, List[dict]]:
    split_map: Dict[str, List[dict]] = {}
    for page in split_pages:
        parsed = split_page_to_record(page)
        if not parsed:
            continue
        relation_ids, split_record = parsed
        for relation_id in relation_ids:
            split_map.setdefault(relation_id, []).append(dict(split_record))

    for splits in split_map.values():
        splits.sort(key=lambda item: ((item.get("index") is None), item.get("index") or 0, item.get("name") or ""))
    return split_map



def page_to_activity(
    client: httpx.Client,
    page: dict,
    type_name_by_id: Dict[str, str],
    local_tz: ZoneInfo,
    splits: Optional[List[dict]] = None,
) -> Optional[dict]:
    run_id = extract_run_id_from_page(page)
    if run_id is None:
        return None
    if page.get("archived") or page.get("in_trash"):
        return None

    properties = page.get("properties", {})

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

    type_relation_ids = extract_relation_ids(
        pick_property(properties, "type_relation", "relation")
    )
    workout_type = resolve_type(type_relation_ids, type_name_by_id, title)

    location_country = extract_plain_text(pick_property(properties, "location"))
    average_heartrate = extract_number(pick_property(properties, "avg_hr"))
    max_heartrate = extract_number(pick_property(properties, "max_hr"))
    calories = extract_number(pick_property(properties, "calories"))

    summary_polyline, _ = load_route_from_gpx(
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
        "max_heartrate": max_heartrate,
        "calories": calories,
        "average_speed": (distance / duration_seconds) if duration_seconds > 0 else 0,
        "location_country": location_country,
        "summary_polyline": summary_polyline,
        "source": "notion",
        "notion_page_id": page.get("id"),
        "notion_last_edited_time": page.get("last_edited_time"),
        "splits": splits or [],
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



def load_existing_activities(local_tz: ZoneInfo) -> List[dict]:
    if not os.path.exists(JSON_FILE):
        return []
    try:
        with open(JSON_FILE, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception:
        return []
    if not isinstance(data, list):
        return []

    activities: List[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        run_id = parse_run_id(str(item.get("run_id", "")))
        if run_id is None:
            continue
        item["run_id"] = run_id
        start_local = item.get("start_date_local")
        if start_local:
            try:
                item["_start_date"] = datetime.fromisoformat(start_local).date()
            except ValueError:
                item["_start_date"] = datetime.now(tz=local_tz).date()
        else:
            item["_start_date"] = datetime.now(tz=local_tz).date()
        item["splits"] = [split for split in item.get("splits", []) if isinstance(split, dict)]
        activities.append(item)
    return activities



def compute_sync_anchor(activities: List[dict]) -> Optional[datetime]:
    latest: Optional[datetime] = None
    for activity in activities:
        timestamps = [activity.get("notion_last_edited_time")]
        for split in activity.get("splits", []):
            timestamps.append(split.get("notion_last_edited_time"))
        for value in timestamps:
            parsed = parse_notion_datetime(value)
            if parsed is None:
                continue
            if latest is None or parsed > latest:
                latest = parsed
    if latest is None:
        return None
    return latest - timedelta(seconds=max(SYNC_OVERLAP_SECONDS, 0))



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
    with open(JSON_FILE, "w", encoding="utf-8") as handle:
        json.dump(activities, handle, ensure_ascii=False, indent=2)
    return len(activities)



def sync_from_notion(full_sync: bool = False) -> int:
    workout_database_id = get_env("WORKOUT_DATABASE_ID")
    type_database_id = os.getenv("TYPE_DATABASE_ID")
    split_database_id = os.getenv("SPLIT_DATABASE_ID")
    local_tz = ZoneInfo(os.getenv("WORKOUTS_PAGE_TIMEZONE", BASE_TIMEZONE))

    existing_activities = [] if full_sync else load_existing_activities(local_tz)
    existing_by_run_id = {activity["run_id"]: activity for activity in existing_activities}
    sync_anchor = None if full_sync else compute_sync_anchor(existing_activities)

    def load_split_map(client: httpx.Client) -> Dict[str, List[dict]]:
        if not split_database_id:
            return {}
        try:
            return build_split_map(fetch_database_pages(client, split_database_id))
        except httpx.HTTPStatusError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                print(
                    f"Warning: split database {split_database_id} is not accessible with the current Notion token; skip split sync."
                )
                return {}
            raise

    with httpx.Client(timeout=30.0) as client:
        type_name_by_id = build_type_map(client, type_database_id)
        split_map: Dict[str, List[dict]] = {}

        if full_sync or sync_anchor is None:
            workout_pages = fetch_database_pages(client, workout_database_id)
            split_map = load_split_map(client)
        else:
            workout_pages = fetch_pages_edited_after(client, workout_database_id, sync_anchor)
            if split_database_id:
                try:
                    changed_split_pages = fetch_pages_edited_after(client, split_database_id, sync_anchor)
                except httpx.HTTPStatusError as exc:
                    if exc.response is not None and exc.response.status_code == 404:
                        print(
                            f"Warning: split database {split_database_id} is not accessible with the current Notion token; skip split sync."
                        )
                        changed_split_pages = []
                    else:
                        raise
                if changed_split_pages or workout_pages:
                    split_map = load_split_map(client)
                    for activity in existing_by_run_id.values():
                        page_id = activity.get("notion_page_id")
                        activity["splits"] = split_map.get(page_id, []) if page_id else []

        for page in workout_pages:
            run_id = extract_run_id_from_page(page)
            if run_id is None:
                continue
            activity = page_to_activity(
                client,
                page,
                type_name_by_id,
                local_tz,
                splits=split_map.get(page.get("id"), []),
            )
            if activity is None:
                existing_by_run_id.pop(run_id, None)
                continue
            existing_by_run_id[run_id] = activity

    return write_activities_json(list(existing_by_run_id.values()))



def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync workouts_page activities.json from a Notion workout database."
    )
    parser.add_argument(
        "--full-sync",
        action="store_true",
        help="Force a full resync from Notion instead of incremental sync.",
    )
    parser.add_argument(
        "--preserve-existing",
        action="store_true",
        help="Deprecated compatibility flag. Ignored in favor of incremental sync.",
    )
    args = parser.parse_args()

    activity_count = sync_from_notion(full_sync=args.full_sync)
    print(f"Synced {activity_count} activities from Notion.")


if __name__ == "__main__":
    main()
