# Runtime for guided API projects in FastAPI. TestClient uses httpx2 when it
# is installed (newer Starlette warns on every run with plain httpx).
# Built once by the app (debug-gym/python-fastapi:1); workspace containers run it offline.
FROM python:3.12-slim
RUN pip install --no-cache-dir "fastapi>=0.115,<1" "httpx>=0.27,<1" "httpx2>=2.16,<3"
