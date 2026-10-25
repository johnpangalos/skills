import secrets

from shop import mail

USERS: dict[str, dict] = {}
RESET_TOKENS: dict[str, str] = {}


def send_notification(email, token=None, is_welcome=False, is_password_reset=False):
    if is_welcome:
        subject = "Welcome to the shop"
        body = f"Hi {email}, thanks for signing up."
    elif is_password_reset:
        if token is None:
            raise ValueError("a password reset needs a token")
        subject = "Reset your password"
        body = f"Use this link to reset your password: https://shop.example/reset?token={token}"
    else:
        raise ValueError("unknown notification")
    mail.send(email, subject, body)


def register_user(email: str) -> None:
    if email in USERS:
        raise ValueError("already registered")
    USERS[email] = {"email": email}
    send_notification(email, is_welcome=True)


def request_password_reset(email: str) -> str:
    if email not in USERS:
        raise KeyError(email)
    token = secrets.token_urlsafe(16)
    RESET_TOKENS[token] = email
    send_notification(email, token=token, is_password_reset=True)
    return token
