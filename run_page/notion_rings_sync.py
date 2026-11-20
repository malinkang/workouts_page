#!/usr/bin/env python3
"""Build the static Apple Fitness ring calendar from Notion Keep."""

from __future__ import annotations

import argparse
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any, Callable

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"
RETRYABLE_STATUSES = {408, 409, 429, 500, 502, 503, 504}
DEFAULT_DATABASE_TITLE = "Apple 活动圆环"
DEFAULT_ROOT_PAGE_ID = "3b486019-c92c-81b2-86d0-da263527d118"
OUTPUT_FILE = Path(__file__).resolve().parents[1] / "src/static/activity_rings.json"

FIELD_ALIASES = {
    "date": ("日期", "Date", "date"),
    "move_actual": ("活动热量", "Move Actual", "Move", "move_actual"),
    "move_goal": ("活动热量目标", "Move Goal", "move_goal"),
    "exercise_actual": ("锻炼分钟", "Exercise Actual", "Exercise", "exercise_actual"),
    "exercise_goal": ("锻炼目标", "Exercise Goal", "exercise_goal"),
    "stand_actual": ("站立小时", "Stand Actual", "Stand", "stand_actual"),
    "stand_goal": ("站立目标", "Stand Goal", "stand_goal"),
}


class NotionError(RuntimeError):
    """Raised when the Notion API returns an unusable response."""


class NotionClient:
    def __init__(
        self,
        token: str,
        *,
        opener: Callable = urllib.request.urlopen,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.token = token
        self.opener = opener
        self.sleep = sleep

    def request(self, method: str, path: str, payload: dict | None = None) -> dict:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            NOTION_API_BASE + path,
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Notion-Version": NOTION_VERSION,
                "Content-Type": "application/json",
            },
        )
        for attempt in range(5):
            try:
                with self.opener(request) as response:
                    return json.loads(response.read() or b"{}")
            except urllib.error.HTTPError as error:
                if error.code not in RETRYABLE_STATUSES or attempt == 4:
                    raise NotionError(f"Notion API {error.code}: request failed") from error
                retry_after = error.headers.get("Retry-After") if error.headers else None
                try:
                    delay = float(retry_after) if retry_after else 0.5 * 2**attempt
                except (TypeError, ValueError):
                    delay = 0.5 * 2**attempt
                self.sleep(max(0.0, min(delay, 30.0)))
            except urllib.error.URLError as error:
                if attempt == 4:
                    raise NotionError("Notion API network request failed") from error
                self.sleep(min(0.5 * 2**attempt, 8.0))
        raise AssertionError("unreachable")

    def children(self, block_id: str) -> list[dict]:
        return self._paged_get(f"/blocks/{block_id}/children")

    def query_database(self, database_id: str) -> list[dict]:
        results: list[dict] = []
        cursor: str | None = None
        while True:
            payload: dict[str, Any] = {"page_size": 100}
            if cursor:
                payload["start_cursor"] = cursor
            response = self.request(
                "POST",
                f"/databases/{database_id}/query",
                payload,
            )
            results.extend(response.get("results", []))
            cursor = response.get("next_cursor")
            if not response.get("has_more") or not cursor:
                return results

    def _paged_get(self, path: str) -> list[dict]:
        results: list[dict] = []
        cursor: str | None = None
        while True:
            query = "?page_size=100"
            if cursor:
                query += "&start_cursor=" + urllib.parse.quote(cursor)
            response = self.request("GET", path + query)
            results.extend(response.get("results", []))
            cursor = response.get("next_cursor")
            if not response.get("has_more") or not cursor:
                return results


def _property(properties: dict, aliases: tuple[str, ...]) -> dict | None:
    for alias in aliases:
        prop = properties.get(alias)
        if prop:
            return prop
    return None


def _number_value(properties: dict, aliases: tuple[str, ...]) -> float | None:
    prop = _property(properties, aliases)
    if not prop:
        return None
    kind = prop.get("type")
    value: Any = None
    if kind == "number":
        value = prop.get("number")
    elif kind == "formula":
        formula = prop.get("formula") or {}
        if formula.get("type") == "number":
            value = formula.get("number")
    elif kind in {"rich_text", "title"}:
        text = "".join(item.get("plain_text", "") for item in prop.get(kind, []))
        try:
            value = float(text)
        except ValueError:
            return None
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _date_value(page: dict) -> str | None:
    properties = page.get("properties") or {}
    prop = _property(properties, FIELD_ALIASES["date"])
    if prop and prop.get("type") == "date":
        candidate = str((prop.get("date") or {}).get("start") or "")[:10]
    else:
        candidate = ""
        for value in properties.values():
            if value.get("type") != "date":
                continue
            candidate = str((value.get("date") or {}).get("start") or "")[:10]
            if candidate:
                break
    if not candidate:
        for value in properties.values():
            if value.get("type") == "title":
                candidate = "".join(
                    item.get("plain_text", "") for item in value.get("title", [])
                )[:10]
                if candidate:
                    break
    try:
        return date.fromisoformat(candidate).isoformat()
    except ValueError:
        return None


def page_to_ring_record(page: dict) -> dict | None:
    """Convert one Notion row to static-page data when all three rings closed."""
    if page.get("archived") or page.get("in_trash"):
        return None
    properties = page.get("properties") or {}
    date_key = _date_value(page)
    values = {
        key: _number_value(properties, aliases)
        for key, aliases in FIELD_ALIASES.items()
        if key != "date"
    }
    if date_key is None or any(value is None for value in values.values()):
        return None
    if any(values[f"{ring}_actual"] < values[f"{ring}_goal"] for ring in ("move", "exercise", "stand")):
        return None
    return {
        "ring_id": page.get("id"),
        "date": date_key,
        **{key: round(float(value), 6) for key, value in values.items()},
        "notion_last_edited_time": page.get("last_edited_time"),
    }


def find_ring_database(
    client: NotionClient,
    root_page_id: str,
    expected_title: str = DEFAULT_DATABASE_TITLE,
) -> str:
    queue = [root_page_id]
    visited: set[str] = set()
    databases: list[tuple[str, str]] = []
    while queue:
        parent = queue.pop(0)
        if parent in visited:
            continue
        visited.add(parent)
        for block in client.children(parent):
            block_type = block.get("type")
            if block_type == "child_database":
                title = (block.get("child_database") or {}).get("title") or ""
                databases.append((title, block.get("id") or ""))
            elif block_type == "child_page" and block.get("id"):
                queue.append(block["id"])
    matches = [database_id for title, database_id in databases if title == expected_title]
    if matches:
        return matches[0]
    available = ", ".join(title for title, _ in databases if title) or "none"
    raise NotionError(
        f"Notion database {expected_title!r} was not found under the Keep page; "
        f"available databases: {available}"
    )


def records_from_pages(pages: list[dict]) -> list[dict]:
    by_date: dict[str, dict] = {}
    for page in pages:
        record = page_to_ring_record(page)
        if record is None:
            continue
        old = by_date.get(record["date"])
        if old is None or str(record.get("notion_last_edited_time") or "") > str(
            old.get("notion_last_edited_time") or ""
        ):
            by_date[record["date"]] = record
    return [by_date[date] for date in sorted(by_date)]


def write_records(output: Path, records: list[dict]) -> bool:
    output.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(records, ensure_ascii=False, indent=2) + "\n"
    if output.exists() and output.read_text(encoding="utf-8") == content:
        return False
    output.write_text(content, encoding="utf-8")
    return True


def sync_from_notion(
    output: Path,
    token: str,
    *,
    root_page_id: str | None = DEFAULT_ROOT_PAGE_ID,
    database_id: str | None = None,
    database_title: str = DEFAULT_DATABASE_TITLE,
) -> tuple[int, bool, str]:
    client = NotionClient(token)
    if not database_id:
        if not root_page_id:
            raise ValueError("A Notion root page ID is required")
        database_id = find_ring_database(client, root_page_id, database_title)
    pages = client.query_database(database_id)
    if not pages:
        raise NotionError(
            f"Notion database {database_id} is empty; refusing to replace static ring data"
        )
    records = records_from_pages(pages)
    changed = write_records(output, records)
    return len(records), changed, database_id


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT_FILE)
    parser.add_argument(
        "--root-page-id",
        default=os.getenv("NOTION_ROOT_PAGE_ID") or DEFAULT_ROOT_PAGE_ID,
    )
    parser.add_argument(
        "--database-id",
        default=os.getenv("ACTIVITY_RING_DATABASE_ID") or None,
    )
    parser.add_argument(
        "--database-title",
        default=os.getenv("ACTIVITY_RING_DATABASE_TITLE") or DEFAULT_DATABASE_TITLE,
    )
    args = parser.parse_args()

    token = os.getenv("NOTION_TOKEN")
    if not token:
        parser.error("NOTION_TOKEN is required")
    count, changed, database_id = sync_from_notion(
        args.output,
        token,
        root_page_id=args.root_page_id,
        database_id=args.database_id,
        database_title=args.database_title,
    )
    print(
        json.dumps(
            {
                "database_id": database_id,
                "closed_days": count,
                "changed": changed,
                "output": str(args.output),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
