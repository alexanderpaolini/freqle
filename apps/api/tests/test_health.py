from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"service": "freqle-api", "status": "ok"}


def test_cosine_similarity(monkeypatch) -> None:
    class DummyModel:
        pass

    monkeypatch.setattr(main_module, "get_embedding_model", lambda: DummyModel())
    monkeypatch.setattr(main_module, "_cosine_score", lambda model, text1, text2: 0.987654)

    client = TestClient(app)
    response = client.post(
        "/cosine_similarity",
        json={"text1": "hello world", "text2": "hello there"},
    )

    assert response.status_code == 200
    assert response.json() == {"cosine_similarity": 0.987654}


def test_cosine_similarity_validation() -> None:
    client = TestClient(app)
    response = client.post(
        "/cosine_similarity",
        json={"text1": "", "text2": "hello there"},
    )
    assert response.status_code == 422


def test_cosine_similarity_model_unavailable(monkeypatch) -> None:
    def _raise() -> None:
        raise RuntimeError("model failed")

    monkeypatch.setattr(main_module, "get_embedding_model", _raise)

    client = TestClient(app)
    response = client.post(
        "/cosine_similarity",
        json={"text1": "a", "text2": "b"},
    )
    assert response.status_code == 503


def test_cosine_similarity_inference_error(monkeypatch) -> None:
    class DummyModel:
        pass

    def _raise(model, text1: str, text2: str) -> float:
        raise RuntimeError("inference failed")

    monkeypatch.setattr(main_module, "get_embedding_model", lambda: DummyModel())
    monkeypatch.setattr(main_module, "_cosine_score", _raise)

    client = TestClient(app)
    response = client.post(
        "/cosine_similarity",
        json={"text1": "a", "text2": "b"},
    )
    assert response.status_code == 502
