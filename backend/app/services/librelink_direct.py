"""
Direct LibreLink/LibreView API client.

Ports the nightscout-librelink-up polling logic into GlucoAssist so the
MongoDB + Nightscout + nightscout-librelink-up stack is no longer required.

Set CGM_SOURCE=librelink_direct and provide LIBRELINK_EMAIL / LIBRELINK_PASSWORD
/ LIBRELINK_REGION (default EU) to enable this path.

Limitations:
  - The /graph endpoint returns only the current sensor window (~8 h of readings).
    Historical backfill is not supported for this source.
  - Abbott's API is unofficial; SSL cipher manipulation is required to bypass
    Cloudflare.  The implementation mirrors the approach used by the open-source
    nightscout-librelink-up project.
"""

import hashlib
import json
import logging
import os
import ssl
import time
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.glucose import GlucoseReading

logger = logging.getLogger(__name__)

# ── LibreView API constants ────────────────────────────────────────────────────

_LLU_VERSION = "4.7.0"
_LLU_PRODUCT = "llu.ios"
_LLU_USER_AGENT = f"FreeStyle LibreLink {_LLU_VERSION} CFNetwork/1399 Darwin/22.1.0"

_REGION_HOSTS: dict[str, str] = {
    "AE": "api-ae.libreview.io",
    "AP": "api-ap.libreview.io",
    "AU": "api-au.libreview.io",
    "CA": "api-ca.libreview.io",
    "DE": "api-de.libreview.io",
    "EU": "api-eu.libreview.io",
    "EU2": "api-eu2.libreview.io",
    "FR": "api-fr.libreview.io",
    "JP": "api-jp.libreview.io",
    "US": "api-us.libreview.io",
}

# Integer trend values returned by the LibreView graph endpoint
_LLU_TREND_MAP: dict[int, str | None] = {
    1: "DoubleDown",
    2: "SingleDown",
    3: "FortyFiveDown",
    4: "Flat",
    5: "FortyFiveUp",
    6: "SingleUp",
    7: "DoubleUp",
}

# ── SSL context ───────────────────────────────────────────────────────────────


def _create_ssl_context() -> ssl.SSLContext:
    """
    Build an SSL context with TLS 1.2 cipher ordering that mimics an iOS
    LibreLink client, helping bypass Cloudflare bot detection on LibreView.

    TLS 1.3 cipher suites are always negotiated by the runtime regardless of
    the cipher string; only TLS 1.2 ordering can be controlled via set_ciphers().
    """
    ctx = ssl.create_default_context()
    ctx.set_ciphers(
        "ECDHE-ECDSA-AES256-GCM-SHA384:"
        "ECDHE-ECDSA-AES128-GCM-SHA256:"
        "ECDHE-RSA-AES256-GCM-SHA384:"
        "ECDHE-RSA-AES128-GCM-SHA256:"
        "ECDHE-ECDSA-CHACHA20-POLY1305:"
        "ECDHE-RSA-CHACHA20-POLY1305:"
        "ECDHE-RSA-AES256-SHA384:"
        "ECDHE-RSA-AES128-SHA256"
    )
    return ctx


_SSL_CONTEXT = _create_ssl_context()

# ── Timestamp parsing ─────────────────────────────────────────────────────────


def _parse_llu_timestamp(ts_str: str) -> datetime:
    """
    Parse a LibreView timestamp string to a naive UTC datetime.

    LibreView returns ``FactoryTimestamp`` in the format ``M/D/YYYY H:MM:SS AM/PM``
    (US locale, UTC).  Python's ``%m``/``%d``/``%I`` directives accept both
    zero-padded and unpadded values in strptime.
    """
    return datetime.strptime(ts_str, "%m/%d/%Y %I:%M:%S %p")  # noqa: DTZ007 (UTC by convention)


# ── Token cache ───────────────────────────────────────────────────────────────


def _load_token_cache(path: str) -> dict | None:
    if not path or not os.path.exists(path):
        return None
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return None


def _save_token_cache(path: str, data: dict) -> None:
    if not path:
        return
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as fh:
            json.dump(data, fh)
    except OSError as exc:
        logger.warning("LLU: could not write token cache to %s: %s", path, exc)


def _is_token_valid(cache: dict) -> bool:
    """Return True if the cached token has at least 60 s of remaining validity."""
    expires = cache.get("expires", 0)
    return bool(expires) and (expires - time.time()) > 60


# ── LLUClient ─────────────────────────────────────────────────────────────────


class LLUClient:
    """
    Minimal LibreView API client.

    Mirrors the token-caching pattern used by garmin_ingest.py:
      - Load token from disk on construction.
      - Re-authenticate automatically when the token has expired.
      - Cache the new token to disk after a successful login.
    """

    def __init__(self, settings: Settings) -> None:
        region = (settings.librelink_region or "EU").upper()
        host = _REGION_HOSTS.get(region, _REGION_HOSTS["EU"])
        self._base_url = f"https://{host}"
        self._email = settings.librelink_email
        self._password = settings.librelink_password
        self._tokenstore = settings.librelink_tokenstore

        self._token: str | None = None
        self._account_id: str | None = None
        self._connection_id: str | None = None

        cached = _load_token_cache(self._tokenstore)
        if cached and _is_token_valid(cached):
            self._token = cached.get("token")
            self._account_id = cached.get("account_id")
            self._connection_id = cached.get("connection_id")
            logger.debug("LLU: loaded valid token from cache")

    # ── private helpers ────────────────────────────────────────────────────

    def _base_headers(self) -> dict[str, str]:
        return {
            "version": _LLU_VERSION,
            "product": _LLU_PRODUCT,
            "User-Agent": _LLU_USER_AGENT,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _auth_headers(self) -> dict[str, str]:
        headers = self._base_headers()
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        if self._account_id:
            headers["account-id"] = self._account_id
        return headers

    def _client(self) -> httpx.Client:
        return httpx.Client(verify=_SSL_CONTEXT, timeout=15.0)

    # ── authentication ─────────────────────────────────────────────────────

    def login(self) -> bool:
        """Authenticate and cache the new token. Returns True on success."""
        logger.info("LLU: authenticating as %s (region=%s)", self._email, self._base_url)
        try:
            with self._client() as http:
                resp = http.post(
                    f"{self._base_url}/llu/auth/login",
                    json={"email": self._email, "password": self._password},
                    headers=self._base_headers(),
                )
                resp.raise_for_status()
                body = resp.json()
        except httpx.HTTPError as exc:
            logger.error("LLU: login HTTP error: %s", exc)
            return False

        if body.get("status") != 0:
            logger.error("LLU: login failed (status=%s)", body.get("status"))
            return False

        data = body.get("data") or {}
        ticket = data.get("authTicket") or {}
        user = data.get("user") or {}

        self._token = ticket.get("token")
        expires = ticket.get("expires", 0)
        user_id = user.get("id", "")
        self._account_id = hashlib.sha256(user_id.encode()).hexdigest()

        _save_token_cache(
            self._tokenstore,
            {
                "token": self._token,
                "expires": expires,
                "user_id": user_id,
                "account_id": self._account_id,
                # connection_id refreshed separately
                "connection_id": self._connection_id,
            },
        )
        logger.info("LLU: login successful — token expires at %s", expires)
        return bool(self._token)

    def _ensure_authenticated(self) -> bool:
        """Re-authenticate if no token is present. Returns True if ready."""
        if self._token:
            return True
        return self.login()

    # ── connections ────────────────────────────────────────────────────────

    def _fetch_connection_id(self) -> str | None:
        """Fetch the first patient connection ID from /llu/connections."""
        try:
            with self._client() as http:
                resp = http.get(
                    f"{self._base_url}/llu/connections",
                    headers=self._auth_headers(),
                )
                resp.raise_for_status()
                body = resp.json()
        except httpx.HTTPError as exc:
            logger.error("LLU: /connections HTTP error: %s", exc)
            return None

        connections = body.get("data") or []
        if not connections:
            logger.error("LLU: no connections found for this account")
            return None

        conn_id: str = connections[0].get("patientId", "")
        logger.info("LLU: using connection %s", conn_id)
        return conn_id or None

    def _ensure_connection_id(self) -> bool:
        """Populate self._connection_id if not already cached. Returns True if ready."""
        if self._connection_id:
            return True
        self._connection_id = self._fetch_connection_id()
        if self._connection_id:
            # Persist connection_id to avoid an extra HTTP round-trip on the next run
            cached = _load_token_cache(self._tokenstore) or {}
            cached["connection_id"] = self._connection_id
            _save_token_cache(self._tokenstore, cached)
        return bool(self._connection_id)

    # ── graph data ─────────────────────────────────────────────────────────

    def fetch_readings(self) -> list[GlucoseReading]:
        """
        Fetch glucose readings from the current sensor window (~8 h).

        Returns a list of GlucoseReading objects ready for bulk insert.
        Re-authenticates automatically if the token has expired (HTTP 401).
        """
        if not self._ensure_authenticated():
            logger.error("LLU: cannot fetch — authentication failed")
            return []

        if not self._ensure_connection_id():
            logger.error("LLU: cannot fetch — no connection ID")
            return []

        url = f"{self._base_url}/llu/connections/{self._connection_id}/graph"
        try:
            with self._client() as http:
                resp = http.get(url, headers=self._auth_headers())

                if resp.status_code == 401:
                    logger.info("LLU: token expired — re-authenticating")
                    self._token = None
                    if not self.login():
                        return []
                    resp = http.get(url, headers=self._auth_headers())

                resp.raise_for_status()
                body = resp.json()
        except httpx.HTTPError as exc:
            logger.error("LLU: /graph HTTP error: %s", exc)
            return []

        if body.get("status") != 0:
            logger.error("LLU: /graph returned status=%s", body.get("status"))
            return []

        return self._parse_graph_response(body.get("data") or {})

    # ── parsing ────────────────────────────────────────────────────────────

    def _parse_reading(
        self,
        entry: dict,
        *,
        trend_arrow: str | None = None,
    ) -> GlucoseReading | None:
        """Convert a single LibreView graph entry to a GlucoseReading."""
        raw_ts = entry.get("FactoryTimestamp") or entry.get("Timestamp")
        value = entry.get("ValueInMgPerDl")

        if raw_ts is None or value is None:
            return None

        try:
            timestamp = _parse_llu_timestamp(raw_ts)
        except ValueError:
            logger.debug("LLU: cannot parse timestamp %r — skipping", raw_ts)
            return None

        return GlucoseReading(
            timestamp=timestamp,
            glucose_mg_dl=int(value),
            trend_arrow=trend_arrow,
            source="librelink_direct",
            device_id=None,
        )

    def _parse_graph_response(self, data: dict) -> list[GlucoseReading]:
        """
        Parse the /graph response body into GlucoseReading objects.

        Combines:
          - ``data.connection.glucoseMeasurement`` — the current reading with trend
          - ``data.graphData`` — historical readings without trend arrows
        """
        readings: list[GlucoseReading] = []

        # Current reading (has TrendArrow)
        connection = data.get("connection") or {}
        current_raw = connection.get("glucoseMeasurement") or {}
        trend_int = current_raw.get("TrendArrow")
        trend_str = _LLU_TREND_MAP.get(trend_int) if trend_int is not None else None
        current = self._parse_reading(current_raw, trend_arrow=trend_str)
        if current:
            readings.append(current)

        # Historical graph data (no TrendArrow)
        for entry in data.get("graphData") or []:
            reading = self._parse_reading(entry)
            if reading:
                readings.append(reading)

        logger.debug("LLU: parsed %d readings from /graph response", len(readings))
        return readings


# ── top-level ingest function ─────────────────────────────────────────────────


def run_librelink_direct_ingest(db: Session, settings: Settings) -> int:
    """
    Fetch readings from LibreView and bulk-insert into SQLite.

    Called by the scheduler when ``CGM_SOURCE=librelink_direct``.
    Returns the count of new readings inserted.
    """
    if not settings.librelink_email or not settings.librelink_password:
        logger.warning(
            "LLU: LIBRELINK_EMAIL / LIBRELINK_PASSWORD not set — skipping ingest"
        )
        return 0

    from app.services.ingest import _bulk_insert  # deferred to avoid circular import

    client = LLUClient(settings)
    readings = client.fetch_readings()

    if not readings:
        logger.warning("LLU: 0 readings returned from /graph")
        return 0

    inserted = _bulk_insert(db, readings)
    logger.info(
        "LLU direct ingest: %d new readings inserted (from %d fetched)",
        inserted,
        len(readings),
    )
    return inserted
