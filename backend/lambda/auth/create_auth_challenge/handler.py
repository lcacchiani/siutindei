"""Cognito Create Auth Challenge trigger."""

from app.auth.passwordless import build_challenge, send_sign_in_email


def lambda_handler(event, _context):
    request = event.get("request", {})
    response = event.setdefault("response", {})

    if request.get("challengeName") != "CUSTOM_CHALLENGE":
        return event

    user_attributes = request.get("userAttributes") or {}
    email = user_attributes.get("email", "")
    challenge = build_challenge()
    code = challenge["code"]

    if email:
        send_sign_in_email(email, code)

    response["publicChallengeParameters"] = {"email": email}
    response["privateChallengeParameters"] = {"answer": code}
    response["challengeMetadata"] = "EMAIL_OTP"
    return event
