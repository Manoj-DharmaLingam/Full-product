import sys
import os

# Add the backend root to sys.path so all package imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app  # noqa: E402 — path must be set before import
