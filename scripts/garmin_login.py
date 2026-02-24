#!/usr/bin/env python3
"""
One-time Garmin token seeding script.

Run this interactively (inside or outside the container) to authenticate
with Garmin Connect and persist OAuth tokens so the ingest service can
operate without repeating the SSO flow — required when MFA is enabled.

Usage:
    python scripts/garmin_login.py

The script reads GARMIN_USERNAME, GARMIN_PASSWORD, and GARMIN_TOKENSTORE
from the environment (or .env).  Tokens are written to GARMIN_TOKENSTORE
(default: /data/garmin_tokens).

To run inside the container:
    docker exec -it glucoassist python /app/scripts/garmin_login.py
"""

import os
import sys


def main() -> None:
    try:
        from garminconnect import Garmin
    except ImportError:
        print("ERROR: garminconnect is not installed.")
        sys.exit(1)

    username = os.environ.get("GARMIN_USERNAME", "").strip()
    password = os.environ.get("GARMIN_PASSWORD", "").strip()
    tokenstore = os.environ.get("GARMIN_TOKENSTORE", "/data/garmin_tokens").strip()

    if not username or not password:
        print("ERROR: GARMIN_USERNAME and GARMIN_PASSWORD must be set.")
        sys.exit(1)

    def prompt_mfa() -> str:
        return input("Enter MFA/2FA code from your authenticator app: ").strip()

    print(f"Authenticating as {username} …")
    client = Garmin(username, password, prompt_mfa=prompt_mfa)
    try:
        client.login()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: Login failed: {exc}")
        sys.exit(1)

    client.garth.dump(tokenstore)
    print(f"Tokens saved to {tokenstore}")
    print("The ingest service will now use these tokens automatically.")


if __name__ == "__main__":
    main()
