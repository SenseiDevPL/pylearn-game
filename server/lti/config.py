"""
LTI 1.3 Advantage configuration.

Before deploying:
1. Generate RSA key pair: openssl genrsa -out private.key 2048
2. Extract public key: openssl rsa -in private.key -pubout -out public.key
3. Register this tool in your LMS (Moodle/Canvas) and fill in the values below.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

LTI_CONFIG = {
    # Fill these after registering in your LMS
    "issuer": os.environ.get("LTI_ISSUER", "https://your-lms.example.com"),
    "client_id": os.environ.get("LTI_CLIENT_ID", "your-client-id"),
    "deployment_id": os.environ.get("LTI_DEPLOYMENT_ID", "1"),
    "auth_login_url": os.environ.get("LTI_AUTH_LOGIN_URL", "https://your-lms.example.com/mod/lti/auth.php"),
    "auth_token_url": os.environ.get("LTI_AUTH_TOKEN_URL", "https://your-lms.example.com/mod/lti/token.php"),
    "key_set_url": os.environ.get("LTI_KEY_SET_URL", "https://your-lms.example.com/mod/lti/certs.php"),
    "private_key_file": str(BASE_DIR / "private.key"),
    "public_key_file": str(BASE_DIR / "public.key"),
}
