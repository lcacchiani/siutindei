"""Cognito Pre Sign-Up trigger to auto-confirm email users."""


def lambda_handler(event, _context):
    response = event.setdefault("response", {})
    response["autoConfirmUser"] = True
    response["autoVerifyEmail"] = True
    return event
