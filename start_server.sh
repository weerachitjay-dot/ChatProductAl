#!/bin/bash
cd "$(dirname "$0")"

# Check if port 8123 is in use
if lsof -i :8123; then
    echo "Port 8123 is already in use. Killing the process..."
    lsof -ti :8123 | xargs kill -9
fi

# Start the server in the background
echo "Starting Coppy Web Server on 8123..."
python3 -m http.server 8123 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Open in browser
open "http://localhost:8123"

# Keep script running to maintain server
wait $SERVER_PID
