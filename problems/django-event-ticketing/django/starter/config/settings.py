"""Settings for the Turnstile ticketing API.

Tests, the demo and a local server share these settings. The database is
SQLite in memory, so every process starts empty.
"""

SECRET_KEY = "turnstile-local-only"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "accounts",
    "ticketing",
]
MIDDLEWARE = ["django.middleware.common.CommonMiddleware"]
ROOT_URLCONF = "config.urls"

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    # Box-office terminals and the attendee app send an X-Api-Key header.
    "DEFAULT_AUTHENTICATION_CLASSES": ["accounts.authentication.ApiKeyAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "ticketing.errors.api_exception_handler",
}

# Sales policy.
HOLD_MINUTES = 10           # a hold keeps seats for this long while the attendee pays
MAX_SEATS_PER_REQUEST = 8   # seats one hold (or one order) may cover
BOOKING_FEE_CENTS = 150     # added to the order for each seat
