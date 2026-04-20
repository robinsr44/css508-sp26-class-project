#include <httplib.h>

#include <cstdlib>
#include <iostream>

#include "moon_api.h"

int main(int argc, char** argv) {
  int port = 8080;
  if (argc >= 2) port = std::atoi(argv[1]);

  httplib::Server svr;
  register_moon_api_routes(svr);

  std::cout << "moon-api listening on http://0.0.0.0:" << port << std::endl;
  if (!svr.listen("0.0.0.0", port)) {
    std::cerr << "failed to listen on port " << port << std::endl;
    return 1;
  }
  return 0;
}
