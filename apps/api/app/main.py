from functools import lru_cache
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


def _parse_origins(raw_origins: str) -> list[str]:
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "intfloat/e5-large-v2")
DEFAULT_CORS_ORIGINS = "http://localhost:3000"


class TextPair(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text1: str = Field(min_length=1, max_length=2000)
    text2: str = Field(min_length=1, max_length=2000)


app = FastAPI(title="freqle-api", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "freqle-api", "status": "ok"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "freqle-api", "status": "ok"}


@lru_cache(maxsize=1)
def get_embedding_model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(EMBEDDING_MODEL_NAME)


def _cosine_score(model, text1: str, text2: str) -> float:
    from sentence_transformers import util

    emb1 = model.encode(text1, convert_to_tensor=True)
    emb2 = model.encode(text2, convert_to_tensor=True)
    score = float(util.cos_sim(emb1, emb2).item())
    return max(-1.0, min(1.0, score))


@app.post("/cosine_similarity")
def cosine_similarity(pair: TextPair) -> dict[str, float]:
    try:
        model = get_embedding_model()
    except Exception as error:
        raise HTTPException(
            status_code=503, detail="Embedding model is unavailable."
        ) from error

    try:
        score = _cosine_score(model, pair.text1, pair.text2)
    except Exception as error:
        raise HTTPException(
            status_code=502, detail="Could not compute cosine similarity."
        ) from error

    return {"cosine_similarity": score}
