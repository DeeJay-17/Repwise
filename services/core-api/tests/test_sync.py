from typing import Any

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app

from .conftest import auth, sign_in


def change(entity: str, id: str, updated: str, **data: Any) -> dict[str, Any]:
    return {"entity": entity, "id": id, "updatedAt": updated, "data": {"id": id, **data}}


T1 = "2026-11-16T10:00:00.000Z"
T2 = "2026-11-16T11:00:00.000Z"
T3 = "2026-11-16T12:00:00.000Z"


def test_changes_from_one_device_reach_another(client: TestClient) -> None:
    tokens = sign_in(client)
    phone = client.post(
        "/v1/sync",
        headers=auth(tokens),
        json={
            "cursor": 0,
            "changes": [
                change("plans", "p1", T1, name="Full body"),
                change("plan_days", "d1", T1, planId="p1", name="Day 1"),
            ],
        },
    ).json()
    assert phone["accepted"] == 2
    assert phone["changes"] == []  # nothing new from elsewhere, and no echo of its own pushes

    tablet = client.post("/v1/sync", headers=auth(tokens), json={"cursor": 0}).json()
    assert [c["id"] for c in tablet["changes"]] == ["p1", "d1"]
    assert tablet["cursor"] == phone["cursor"]

    # Nothing new since
    again = client.post("/v1/sync", headers=auth(tokens), json={"cursor": tablet["cursor"]}).json()
    assert again["changes"] == []


def test_newest_update_wins(client: TestClient) -> None:
    tokens = sign_in(client)
    client.post(
        "/v1/sync", headers=auth(tokens), json={"changes": [change("plans", "p1", T2, name="B")]}
    )
    stale = client.post(
        "/v1/sync", headers=auth(tokens), json={"changes": [change("plans", "p1", T1, name="A")]}
    ).json()
    assert stale["accepted"] == 0
    newer = client.post(
        "/v1/sync",
        headers=auth(tokens),
        json={"changes": [{**change("plans", "p1", T3, name="C"), "deletedAt": T3}]},
    ).json()
    assert newer["accepted"] == 1
    pulled = client.post("/v1/sync", headers=auth(tokens), json={"cursor": 0}).json()["changes"]
    assert pulled == [{**change("plans", "p1", T3, name="C"), "deletedAt": T3}]


def test_pulls_in_pages(client: TestClient, settings: Settings) -> None:
    app.dependency_overrides[get_settings] = lambda: settings.model_copy(
        update={"sync_page_size": 2}
    )
    tokens = sign_in(client)
    client.post(
        "/v1/sync",
        headers=auth(tokens),
        json={"changes": [change("set_logs", f"s{i}", T1, reps=i) for i in range(5)]},
    )
    cursor, seen = 0, []
    while True:
        page = client.post("/v1/sync", headers=auth(tokens), json={"cursor": cursor}).json()
        seen += [c["id"] for c in page["changes"]]
        cursor = page["cursor"]
        if not page["hasMore"]:
            break
    assert seen == ["s0", "s1", "s2", "s3", "s4"]


def test_users_only_see_their_own_data(client: TestClient) -> None:
    alice = sign_in(client, "g-a", "a@example.com")
    bob = sign_in(client, "g-b", "b@example.com")
    client.post("/v1/sync", headers=auth(alice), json={"changes": [change("plans", "p1", T1)]})
    assert client.post("/v1/sync", headers=auth(bob), json={"cursor": 0}).json()["changes"] == []


def test_rejects_unknown_tables_and_huge_records(client: TestClient) -> None:
    tokens = sign_in(client)
    bad = client.post(
        "/v1/sync", headers=auth(tokens), json={"changes": [change("users", "u", T1)]}
    )
    assert bad.status_code == 422
    huge = client.post(
        "/v1/sync",
        headers=auth(tokens),
        json={"changes": [change("plans", "p", T1, notes="x" * 20_000)]},
    )
    assert huge.status_code == 413
    assert client.post("/v1/sync", json={"cursor": 0}).status_code == 401
