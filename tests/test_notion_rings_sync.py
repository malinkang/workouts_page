import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).parents[1] / "run_page/notion_rings_sync.py"
SPEC = importlib.util.spec_from_file_location("notion_rings_sync", SCRIPT)
sync = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = sync
SPEC.loader.exec_module(sync)


def page(
    date,
    *,
    move=(600, 500),
    exercise=(30, 30),
    stand=(12, 12),
    page_id="ring-page",
    edited="2026-01-04T10:00:00Z",
):
    return {
        "id": page_id,
        "last_edited_time": edited,
        "properties": {
            "标题": {
                "type": "title",
                "title": [{"plain_text": date}],
            },
            "日期": {
                "type": "date",
                "date": {"start": date},
            },
            "活动热量": {"type": "number", "number": move[0]},
            "活动热量目标": {"type": "number", "number": move[1]},
            "锻炼分钟": {"type": "number", "number": exercise[0]},
            "锻炼目标": {"type": "number", "number": exercise[1]},
            "站立小时": {"type": "number", "number": stand[0]},
            "站立目标": {"type": "number", "number": stand[1]},
        },
    }


class NotionRingSyncTests(unittest.TestCase):
    def test_only_fully_closed_days_are_exported(self):
        self.assertIsNotNone(sync.page_to_ring_record(page("2026-01-04")))
        self.assertIsNone(
            sync.page_to_ring_record(page("2026-01-05", exercise=(29, 30)))
        )
        self.assertIsNone(
            sync.page_to_ring_record(page("2026-01-06", stand=(11, 12)))
        )

    def test_page_fields_map_to_static_schema(self):
        record = sync.page_to_ring_record(
            page("2026-01-04", move=(620.25, 500), edited="2026-01-05T00:00:00Z")
        )

        self.assertEqual(record, {
            "ring_id": "ring-page",
            "date": "2026-01-04",
            "move_actual": 620.25,
            "move_goal": 500.0,
            "exercise_actual": 30.0,
            "exercise_goal": 30.0,
            "stand_actual": 12.0,
            "stand_goal": 12.0,
            "notion_last_edited_time": "2026-01-05T00:00:00Z",
        })

    def test_duplicate_dates_keep_the_newest_edit(self):
        records = sync.records_from_pages([
            page("2026-01-04", move=(500, 500), page_id="old", edited="2026-01-04T10:00:00Z"),
            page("2026-01-04", move=(650, 500), page_id="new", edited="2026-01-04T12:00:00Z"),
        ])

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["ring_id"], "new")
        self.assertEqual(records[0]["move_actual"], 650.0)

    def test_database_discovery_recurses_through_keep_pages(self):
        class Client:
            def children(self, block_id):
                if block_id == "root":
                    return [{"id": "keep", "type": "child_page"}]
                return [{
                    "id": "ring-db",
                    "type": "child_database",
                    "child_database": {"title": sync.DEFAULT_DATABASE_TITLE},
                }]

        self.assertEqual(
            sync.find_ring_database(Client(), "root"),
            "ring-db",
        )

    def test_database_query_uses_cursor_pagination(self):
        calls = []

        class Client(sync.NotionClient):
            def request(self, method, path, payload=None):
                calls.append((method, path, payload))
                if len(calls) == 1:
                    return {
                        "results": [{"id": "one"}],
                        "has_more": True,
                        "next_cursor": "next",
                    }
                return {
                    "results": [{"id": "two"}],
                    "has_more": False,
                    "next_cursor": None,
                }

        pages = Client("token").query_database("ring-db")

        self.assertEqual([item["id"] for item in pages], ["one", "two"])
        self.assertEqual(calls[1][2]["start_cursor"], "next")

    def test_output_is_stable_and_only_rewritten_when_changed(self):
        record = sync.page_to_ring_record(page("2026-01-04"))
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "activity_rings.json"
            self.assertTrue(sync.write_records(output, [record]))
            first = output.read_text(encoding="utf-8")
            self.assertFalse(sync.write_records(output, [record]))
            self.assertEqual(output.read_text(encoding="utf-8"), first)
            self.assertEqual(json.loads(first)[0]["date"], "2026-01-04")

    def test_sync_can_use_database_id_without_walking_the_page_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "rings.json"
            fake_client = mock.Mock()
            fake_client.query_database.return_value = [page("2026-01-04")]
            with (
                mock.patch.object(sync, "NotionClient", return_value=fake_client),
                mock.patch.object(sync, "find_ring_database") as find_database,
            ):
                count, changed, database_id = sync.sync_from_notion(
                    output,
                    "token",
                    database_id="known-db",
                )

        self.assertEqual((count, changed, database_id), (1, True, "known-db"))
        fake_client.query_database.assert_called_once_with("known-db")
        find_database.assert_not_called()

    def test_empty_database_does_not_erase_existing_static_data(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "rings.json"
            output.write_text('[{"date":"2026-01-04"}]', encoding="utf-8")
            fake_client = mock.Mock()
            fake_client.query_database.return_value = []
            with mock.patch.object(sync, "NotionClient", return_value=fake_client):
                with self.assertRaises(sync.NotionError):
                    sync.sync_from_notion(output, "token", database_id="known-db")

            self.assertEqual(
                output.read_text(encoding="utf-8"),
                '[{"date":"2026-01-04"}]',
            )


if __name__ == "__main__":
    unittest.main()
