import os
from dotenv import load_dotenv

load_dotenv()

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "")

# Vercel/serverless filesystems are ephemeral. /tmp is the writable location.
# Locally, keep the database in backend/resqai.db as before.
if os.getenv("DATABASE_URL"):
    DATABASE_URL = os.getenv("DATABASE_URL")
elif os.getenv("VERCEL") == "1":
    DATABASE_URL = "sqlite:////tmp/resqai.db"
else:
    DATABASE_URL = "sqlite:///./resqai.db"

ROUTING_BASE_URL = os.getenv(
    "ROUTING_BASE_URL",
    "https://router.project-osrm.org"
)
