# Judge runtime for build-an-API questions in Python: Flask.
# Built once by the app (debug-gym/python-api:1); judge containers run it offline.
FROM python:3.12-slim
RUN pip install --no-cache-dir flask==3.1.3
