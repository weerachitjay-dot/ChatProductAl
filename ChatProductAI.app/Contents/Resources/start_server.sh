#!/bin/bash
cd "$(dirname "$0")/../../.."

# Check if port 8000 is in use
if lsof -i :8000; then
    echo "Port 8000 is already in use. Killing the process..."
    lsof -ti :8000 | xargs kill -9
fi

# Start the server in the background
echo "Starting Coppy Web Server..."
python3 -m http.server 8000 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Open in browser
open "http://localhost:8000"

# Keep script running to maintain server
wait $SERVER_PID
