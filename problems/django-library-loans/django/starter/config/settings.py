"""Settings for the Shelfwise lending API.

The service is small enough that the tests, the demo and a local server all
share these settings. The database is SQLite in memory: every process starts
with an empty catalogue.
"""

SECRET_KEY = "shelfwise-local-only"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "library",
]
MIDDLEWARE = ["django.middleware.common.CommonMiddleware"]
ROOT_URLCONF = "config.urls"

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    # The desk terminals sit on the branch network; there is no login yet.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "library.errors.api_exception_handler",
}

# Lending policy, agreed with the branch managers.
LOAN_DAYS = 14             # a loan is due this many days after it is lent
MAX_ACTIVE_LOANS = 3       # books a member may have out at once
FINE_PER_DAY_CENTS = 25    # charged for each day a book comes back late
MAX_FINE_CENTS = 1000      # a single loan's fine never exceeds this
