"""Entity tags for cacheable GET responses."""
import hashlib
import json
from typing import Any


def etag_for(payload: Any) -> str:
    """A strong ETag derived from the JSON content: equal content gives an equal tag."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return '"' + hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32] + '"'


def matches(if_none_match: str | None, etag: str) -> bool:
    """Does an ``If-None-Match`` header value cover ``etag``? Handles ``*``, lists and weak tags."""
    if not if_none_match:
        return False
    if if_none_match.strip() == "*":
        return True
    for candidate in if_none_match.split(","):
        candidate = candidate.strip()
        if candidate.startswith("W/"):
            candidate = candidate[2:]
        if candidate == etag:
            return True
    return False
