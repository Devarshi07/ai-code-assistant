# Runtime for guided API projects in Django REST Framework.
# Built once by the app (debug-gym/python-django:1); workspace containers run it offline.
FROM python:3.12-slim
RUN pip install --no-cache-dir "django>=5.2,<5.3" "djangorestframework>=3.15,<3.17"
