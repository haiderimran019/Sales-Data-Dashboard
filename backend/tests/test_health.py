from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_projects_require_authentication() -> None:
    response = TestClient(app).get("/api/projects")

    assert response.status_code == 401
