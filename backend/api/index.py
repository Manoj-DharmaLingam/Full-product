import sys
import os

# Resolve the absolute path to backend root (parent of this api/ directory)
_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from main import app  # noqa: E402 — path must be set before import
