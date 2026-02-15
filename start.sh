#!/bin/bash
# Source environment variables if file exists
if [ -f .env.local ]; then
  export $(cat .env.local | xargs)
fi
PORT=3000 NODE_ENV=development node server.js
