import os
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv

load_dotenv()

# If SUPABASE_URL is missing in the environment, it defaults to the dummy URL
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://fallback.supabase.co")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

jwks_client = PyJWKClient(JWKS_URL)

security = HTTPBearer()

# Comma-separated list of Supabase user UUIDs (operators) allowed to access
# the moderation/admin endpoints. Set this in the environment, e.g.
# ADMIN_USER_IDS="uuid-1,uuid-2,uuid-3" - do NOT hardcode real IDs in source.
_raw_admin_ids = os.getenv("ADMIN_USER_IDS", "")
ADMIN_USER_IDS = {uid.strip() for uid in _raw_admin_ids.split(",") if uid.strip()}


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token).key

        payload = jwt.decode(token, signing_key, algorithms=["ES256"], audience="authenticated")

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_admin_id(user_id: str = Depends(get_current_user_id)) -> str:
    """
    Same JWT check as get_current_user_id, plus an allowlist check.
    Use this to protect the moderation/report-queue endpoints so that
    only the operators (not any logged-in student) can see flag details
    or resolve reports.
    """
    if not ADMIN_USER_IDS:
        # Fail closed: if no admins are configured, nobody gets in rather
        # than accidentally leaving the queue open to everyone.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access not configured")

    if str(user_id) not in ADMIN_USER_IDS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    return user_id