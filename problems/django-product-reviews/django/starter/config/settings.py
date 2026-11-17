"""Settings for the Marketlane reviews service.

Tests, the demo and a local server share these settings. The database is
SQLite in memory, so every process starts with an empty catalogue.
"""

SECRET_KEY = "marketlane-local-only"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "accounts",
    "reviews",
]
MIDDLEWARE = ["django.middleware.common.CommonMiddleware"]
ROOT_URLCONF = "config.urls"

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    # The storefront and the moderation console send an X-Api-Key header.
    # Reading is public; views that write ask for a signed-in account themselves.
    "DEFAULT_AUTHENTICATION_CLASSES": ["accounts.authentication.ApiKeyAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "reviews.errors.api_exception_handler",
}

# Review policy.
REVIEW_MAX_LENGTH = 2000   # characters of review text
DEFAULT_PAGE_SIZE = 10     # items per page when ?page_size is not given
MAX_PAGE_SIZE = 100        # the largest ?page_size accepted
