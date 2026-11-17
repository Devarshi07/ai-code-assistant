"""Settings for the Team Task Tracker API.

The tests, the demo and a local server all share these settings. The database
is SQLite in memory: every process starts with an empty board.
"""

SECRET_KEY = "task-tracker-local-only"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "board",
]
MIDDLEWARE = ["django.middleware.common.CommonMiddleware"]
ROOT_URLCONF = "config.urls"

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    # Every endpoint needs a signed-in user. Real deployments sit behind the
    # company login proxy; the tests sign in with APIClient.force_authenticate.
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.BasicAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "EXCEPTION_HANDLER": "board.errors.api_exception_handler",
}

# Pagination of GET /projects/<id>/tasks/.
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
