"""Cognito Verify Auth Challenge trigger."""


def lambda_handler(event, _context):
    request = event.get("request", {})
    expected = (request.get("privateChallengeParameters") or {}).get("answer")
    provided = request.get("challengeAnswer")
    response = event.setdefault("response", {})
    response["answerCorrect"] = bool(expected) and provided == expected
    return event
