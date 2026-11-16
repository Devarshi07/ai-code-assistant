# Judge runtime for machine-learning questions: Python with NumPy.
# Built once by the app (debug-gym/python-ml:1); judge containers run it offline.
FROM python:3.12-slim
RUN pip install --no-cache-dir numpy==2.5.4
