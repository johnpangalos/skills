"""Password-reset tokens (in-memory store)."""

import secrets

_TOKENS = {}  # token -> username


class InvalidToken(Exception):
    pass


def issue_reset_token(username):
    """Create a reset token for username."""
    token = secrets.token_urlsafe(16)
    _TOKENS[token] = username
    return token


def redeem_reset_token(token):
    """Return the username a token was issued for."""
    username = _TOKENS.get(token)
    if username is None:
        raise InvalidToken("unknown token")
    return username
