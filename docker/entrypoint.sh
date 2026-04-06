#!/bin/bash
set -euo pipefail

# API listens on localhost; nginx proxies /api to this process.
/usr/local/bin/moon-api 8080 &
exec nginx -g "daemon off;"
