"""Cognito Define Auth Challenge trigger."""

import os


def lambda_handler(event, _context):
    max_attempts = int(os.getenv("MAX_CHALLENGE_ATTEMPTS", "3"))
    session = event.get("request", {}).get("session", []) or []
    response = event.setdefault("response", {})

    if session:
        last = session[-1]
        if last.get("challengeName") == "CUSTOM_CHALLENGE" and last.get(
            "challengeResult"
        ):
            response["issueTokens"] = True
            response["failAuthentication"] = False
            return event

        if len(session) >= max_attempts:
            response["issueTokens"] = False
            response["failAuthentication"] = True
            return event

    response["issueTokens"] = False
    response["failAuthentication"] = False
    response["challengeName"] = "CUSTOM_CHALLENGE"
    return event
