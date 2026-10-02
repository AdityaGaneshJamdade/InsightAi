from __future__ import annotations

import hashlib
import math
import re

from app.config import EMBEDDING_DIMENSIONS, GEMINI_API_KEY, GEMINI_EMBEDDING_MODEL


def _local_embedding(text: str) -> list[float]:
    vector = [0.0] * EMBEDDING_DIMENSIONS
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    for token in tokens:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        position = int.from_bytes(digest[:4], "big") % EMBEDDING_DIMENSIONS
        sign = 1.0 if digest[4] & 1 else -1.0
        vector[position] += sign
    magnitude = math.sqrt(sum(value * value for value in vector))
    return [value / magnitude for value in vector] if magnitude else vector


def embed_texts_with_provider(texts: list[str]) -> tuple[list[list[float]], str]:
    if GEMINI_API_KEY and texts:
        try:
            from google import genai

            client = genai.Client(api_key=GEMINI_API_KEY)
            result = client.models.embed_content(model=GEMINI_EMBEDDING_MODEL, contents=texts)
            embeddings = [list(item.values) for item in (result.embeddings or [])]
            if len(embeddings) == len(texts) and all(len(vector) == EMBEDDING_DIMENSIONS for vector in embeddings):
                return embeddings, GEMINI_EMBEDDING_MODEL
        except Exception:
            pass

    return [_local_embedding(text) for text in texts], "local-hash-768"


def embed_texts(texts: list[str]) -> list[list[float]]:
    return embed_texts_with_provider(texts)[0]


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0
