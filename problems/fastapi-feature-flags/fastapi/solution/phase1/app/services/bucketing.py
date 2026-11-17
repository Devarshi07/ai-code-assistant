"""Percentage rollouts: which users fall inside a flag's rollout.

Every (flag, user) pair has a *bucket* from 0 to 99. A user is inside a
rollout of N percent when their bucket is below N. Buckets come from a hash,
so a user keeps the same bucket for a flag across requests, restarts and
servers, and different flags spread the same users differently.
"""
import hashlib

BUCKETS = 100


def bucket_for(flag_key: str, user_id: str) -> int:
    """The bucket (0-99) of a user for a flag: first 8 hex digits of sha256("<key>:<user_id>")."""
    digest = hashlib.sha256(f"{flag_key}:{user_id}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % BUCKETS


def is_in_rollout(flag_key: str, user_id: str, percent: int) -> bool:
    """True when the user is inside a rollout of ``percent`` percent (0-100)."""
    return bucket_for(flag_key, user_id) < percent
