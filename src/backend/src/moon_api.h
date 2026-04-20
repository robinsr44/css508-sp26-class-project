#pragma once

#include <httplib.h>

// Registers all /api/* routes on the given HTTP server (CORS, moon, sun, health, version).
void register_moon_api_routes(httplib::Server& svr);
