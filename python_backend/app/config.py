from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT.parent / ".env", override=False)
load_dotenv(BACKEND_ROOT / ".env", override=False)


def _path_from_env(name: str, default: Path) -> Path:
    value = os.getenv(name)
    path = Path(value) if value else default
    return path if path.is_absolute() else (BACKEND_ROOT / path).resolve()


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{(BACKEND_ROOT / 'data' / 'insightai.db').as_posix()}",
)
UPLOAD_DIR = _path_from_env("UPLOAD_DIR", BACKEND_ROOT / "data" / "uploads")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-005")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "25")) * 1024 * 1024
CHUNK_WORDS = max(100, int(os.getenv("CHUNK_WORDS", "500")))
CHUNK_OVERLAP_WORDS = max(0, min(int(os.getenv("CHUNK_OVERLAP_WORDS", "50")), CHUNK_WORDS - 1))
EMBEDDING_DIMENSIONS = 768
