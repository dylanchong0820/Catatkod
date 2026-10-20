#!/bin/bash
# Double-click in Finder to run CatatKod: sets up anything missing, starts the API and the web app,
# and opens the app in your browser. Close this window (or press Ctrl+C) to stop it.

cd "$(dirname "$0")" || exit 1
API_URL="http://localhost:5001/api/health"
WEB_URL="http://localhost:8443"
PNPM="npx -y pnpm@10.34.3"
STARTED=()      # launcher process ids
STARTED_PORTS=() # ports of the servers this window started (the web server runs as npx -> pnpm -> vite)

stop_all() {
  if [ ${#STARTED[@]} -gt 0 ]; then
    echo ""
    echo "Stopping CatatKod..."
    for pid in "${STARTED[@]}"; do
      pkill -P "$pid" 2>/dev/null
      kill "$pid" 2>/dev/null
    done
    for port in "${STARTED_PORTS[@]}"; do
      lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
    done
  fi
  exit 0
}
trap stop_all INT TERM HUP EXIT

echo "CatatKod"
echo "========"

command -v python3 >/dev/null || { echo "Python 3 is not installed. Install it from python.org, then try again."; read -r -p "Press Enter to close."; exit 1; }
command -v npx >/dev/null || { echo "Node.js is not installed. Install it from nodejs.org, then try again."; read -r -p "Press Enter to close."; exit 1; }

# One-time setup, only when something is missing.
if [ ! -x backend/.venv/bin/python ]; then
  echo "First run: installing Python packages (a few minutes)..."
  python3 -m venv backend/.venv && backend/.venv/bin/pip install -q -r backend/requirements.txt || { read -r -p "Setup failed. Press Enter to close."; exit 1; }
fi
if [ ! -f backend/training/artifacts/icd11_tier1_classifier.joblib ]; then
  echo "First run: training the model (about a minute)..."
  ( cd backend && .venv/bin/python training/prepare_catalogue.py >/dev/null \
    && .venv/bin/python training/generate_synthetic.py >/dev/null \
    && .venv/bin/python training/build_dataset.py >/dev/null \
    && .venv/bin/python training/train.py --allow-draft >/dev/null 2>&1 ) || { read -r -p "Training failed. Press Enter to close."; exit 1; }
fi
if [ ! -d node_modules ]; then
  echo "First run: installing web app packages..."
  $PNPM install || { read -r -p "Setup failed. Press Enter to close."; exit 1; }
fi

# Start each server unless it is already running.
if curl -s "$API_URL" >/dev/null; then
  echo "API already running."
else
  echo "Starting the API..."
  ( cd backend && exec .venv/bin/python app.py ) >/tmp/catatkod_api.log 2>&1 &
  STARTED+=($!)
  STARTED_PORTS+=(5001)
fi
if curl -s -o /dev/null "$WEB_URL"; then
  echo "Web app already running."
else
  echo "Starting the web app..."
  $PNPM dev >/tmp/catatkod_web.log 2>&1 &
  STARTED+=($!)
  STARTED_PORTS+=(8443)
fi

echo "Waiting for CatatKod to be ready..."
for _ in $(seq 1 90); do
  curl -s "$API_URL" >/dev/null && curl -s -o /dev/null "$WEB_URL" && break
  sleep 1
done
if ! curl -s "$API_URL" >/dev/null || ! curl -s -o /dev/null "$WEB_URL"; then
  echo "CatatKod didn't start. Logs: /tmp/catatkod_api.log and /tmp/catatkod_web.log"
  read -r -p "Press Enter to close."
  exit 1
fi

echo ""
echo "CatatKod is running at $WEB_URL"
[ -z "$CATATKOD_NO_BROWSER" ] && open "$WEB_URL"
if [ ${#STARTED[@]} -gt 0 ]; then
  echo "Keep this window open while you use the app. Close it, or press Ctrl+C, to stop CatatKod."
  wait
else
  echo "(It was already running, so closing this window leaves it running.)"
  trap - EXIT
fi
