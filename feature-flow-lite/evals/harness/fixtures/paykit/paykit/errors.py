class PaymentError(Exception):
    """Base class for provider errors. `status` is the HTTP status, if any."""

    def __init__(self, message, status=None, code=None):
        super().__init__(message)
        self.status = status
        self.code = code


class CardDeclined(PaymentError):
    pass


class RateLimited(PaymentError):
    pass


class InvalidRequest(PaymentError):
    pass


class ProviderUnavailable(PaymentError):
    pass


class SignatureError(PaymentError):
    pass
