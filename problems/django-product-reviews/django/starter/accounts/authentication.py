from rest_framework import authentication, exceptions

from accounts.models import Account


class ApiKeyAuthentication(authentication.BaseAuthentication):
    """Identifies the caller from the `X-Api-Key` header.

    No header: the request is anonymous (views that need an account answer 401).
    An unknown key: 401 straight away.
    """

    def authenticate(self, request):
        key = request.headers.get("X-Api-Key")
        if not key:
            return None
        try:
            return Account.objects.get(api_key=key), None
        except Account.DoesNotExist:
            raise exceptions.AuthenticationFailed("Unknown API key.")

    def authenticate_header(self, request):
        # Having a challenge makes DRF answer 401 rather than 403 for anonymous calls.
        return "ApiKey"
