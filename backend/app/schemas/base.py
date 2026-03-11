"""
Shared schema primitives.

UTCDatetime is a datetime type alias that, during JSON serialisation, always
emits an ISO-8601 string with a trailing 'Z' (UTC marker).  SQLite returns
timezone-naive datetimes even when the column is declared with
DateTime(timezone=True); this serialiser treats any naive value as UTC so
that the frontend can parse it unambiguously as a UTC instant.
"""

from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer


def _dt_utc_z(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


UTCDatetime = Annotated[
    datetime,
    PlainSerializer(_dt_utc_z, return_type=str, when_used="json"),
]
