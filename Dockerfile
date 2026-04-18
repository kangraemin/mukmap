FROM python:3.11-slim

WORKDIR /app
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt fastapi uvicorn

COPY worker/ .
COPY rawdata ./rawdata

CMD ["/bin/sh", "-c", "uvicorn api:app --host 0.0.0.0 --port $PORT"]
