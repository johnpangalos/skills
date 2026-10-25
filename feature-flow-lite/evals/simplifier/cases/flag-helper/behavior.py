import secrets
secrets.token_urlsafe = lambda n=None: "TOKEN"
from shop import accounts, mail
accounts.register_user("a@x.io"); accounts.register_user("b@x.io")
print(accounts.request_password_reset("a@x.io"))
for f, a in [(accounts.register_user, "a@x.io"), (accounts.request_password_reset, "zz@x.io")]:
    try: f(a)
    except Exception as e: print(type(e).__name__, e)
print(mail.OUTBOX, accounts.USERS, accounts.RESET_TOKENS)
