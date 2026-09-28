"""
PyLearn LTI 1.3 Advantage Provider

Endpoints:
  POST /lti/login   — OIDC login initiation
  POST /lti/launch  — LTI launch (after OIDC callback)
  GET  /lti/jwks    — JSON Web Key Set (public key for LMS verification)
  POST /lti/grade   — Send grade back to LMS (AGS)
"""

import json
import os
from pathlib import Path

from flask import Flask, jsonify, redirect, request, url_for

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "change-me-in-production")

KEYS_DIR = Path(__file__).resolve().parent


def get_jwks():
    """Return JWKS from public key file."""
    pub_key_path = KEYS_DIR / "public.key"
    if not pub_key_path.exists():
        return {"keys": []}

    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
    import base64

    pub_key_data = pub_key_path.read_bytes()
    pub_key = load_pem_public_key(pub_key_data)
    pub_numbers: RSAPublicNumbers = pub_key.public_numbers()  # type: ignore[assignment]

    def int_to_base64url(n: int) -> str:
        byte_length = (n.bit_length() + 7) // 8
        return base64.urlsafe_b64encode(n.to_bytes(byte_length, "big")).rstrip(b"=").decode()

    return {
        "keys": [
            {
                "kty": "RSA",
                "alg": "RS256",
                "use": "sig",
                "n": int_to_base64url(pub_numbers.n),
                "e": int_to_base64url(pub_numbers.e),
                "kid": "pylearn-key-1",
            }
        ]
    }


@app.route("/lti/jwks", methods=["GET"])
def jwks():
    return jsonify(get_jwks())


@app.route("/lti/login", methods=["POST", "GET"])
def lti_login():
    """OIDC login initiation — redirects back to LMS with auth request."""
    # In production, use pylti1p3 OIDCLogin here
    # This is a boilerplate showing the flow
    target_link_uri = request.form.get("target_link_uri", request.args.get("target_link_uri", ""))
    login_hint = request.form.get("login_hint", request.args.get("login_hint", ""))
    lti_message_hint = request.form.get("lti_message_hint", request.args.get("lti_message_hint", ""))

    return jsonify({
        "status": "login_initiated",
        "target_link_uri": target_link_uri,
        "login_hint": login_hint,
        "lti_message_hint": lti_message_hint,
        "note": "Wire up pylti1p3 OIDCLogin for production use",
    })


@app.route("/lti/launch", methods=["POST"])
def lti_launch():
    """LTI resource launch — validate JWT, extract user info, redirect to game."""
    # In production: validate id_token with pylti1p3
    id_token = request.form.get("id_token", "")

    return jsonify({
        "status": "launch_received",
        "id_token_present": bool(id_token),
        "note": "Validate with pylti1p3 MessageLaunch for production",
        "redirect_to": "/",
    })


@app.route("/lti/grade", methods=["POST"])
def lti_grade():
    """Send grade (level completion) back to LMS via Assignment and Grade Services."""
    data = request.get_json() or {}
    user_id = data.get("user_id")
    level_id = data.get("level_id")
    score = data.get("score", 1.0)

    # In production: use pylti1p3 Grade + AssignmentsGradesService
    return jsonify({
        "status": "grade_recorded",
        "user_id": user_id,
        "level_id": level_id,
        "score": score,
        "note": "Wire up AGS for real LMS gradebook return",
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "pylearn-lti"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
