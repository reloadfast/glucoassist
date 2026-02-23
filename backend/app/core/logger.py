import logging
import sys


def setup_logging(app_env: str = "production") -> None:
    level = logging.DEBUG if app_env == "development" else logging.INFO
    logging.basicConfig(
        stream=sys.stdout,
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
