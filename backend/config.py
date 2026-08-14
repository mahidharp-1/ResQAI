import os
from dotenv import load_dotenv

load_dotenv()

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./resqai.db")
ROUTING_BASE_URL = os.getenv("ROUTING_BASE_URL", "https://router.project-osrm.org")
