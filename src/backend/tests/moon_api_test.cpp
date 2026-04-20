// HTTP-level tests for register_moon_api_routes: health, version, CORS, GET/POST /api/moon and /api/sun,
// validation errors (400), and JSON response shape. Server runs on 127.0.0.1 in a background thread.

#include "moon_api.h"

#include <nlohmann/json.hpp>

#include <chrono>
#include <string>
#include <thread>

#include <httplib.h>

#include "gtest/gtest.h"

namespace {

constexpr const char* kHost = "127.0.0.1";
constexpr int kPort = 38471;

constexpr double kEpsFloat = 1e-5;

httplib::Client NewClient() {
  httplib::Client cli(kHost, kPort);
  cli.set_connection_timeout(2, 0);
  cli.set_read_timeout(5, 0);
  return cli;
}

bool JsonErrorHasMessage(const std::string& body) {
  try {
    const auto j = nlohmann::json::parse(body);
    return j.contains("error") && j["error"].is_string();
  } catch (...) {
    return false;
  }
}

}  // namespace

// -----------------------------------------
// ------------ Health -----------------
// -----------------------------------------

// GET /api/health returns 200 and JSON {"status":"ok"}.
TEST(MoonApiHealth, GetOk) {
  auto cli = NewClient();
  const auto res = cli.Get("/api/health");
  ASSERT_TRUE(res) << "request failed (is the test server running?)";
  EXPECT_EQ(res->status, 200);
  const auto j = nlohmann::json::parse(res->body);
  EXPECT_EQ(j["status"], "ok");
}

// -----------------------------------------
// ------------ Version ----------------
// -----------------------------------------

// GET /api/version returns service name and a version string.
TEST(MoonApiVersion, GetHasServiceAndVersion) {
  auto cli = NewClient();
  const auto res = cli.Get("/api/version");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 200);
  const auto j = nlohmann::json::parse(res->body);
  EXPECT_EQ(j["service"], "moon-api");
  EXPECT_TRUE(j["version"].is_string());
  EXPECT_FALSE(j["version"].get<std::string>().empty());
}

// -----------------------------------------
// ------------ CorsOptions ------------
// -----------------------------------------

// OPTIONS /api/moon returns 204 and CORS headers.
TEST(MoonApiCors, OptionsMoon) {
  auto cli = NewClient();
  const auto res = cli.Options("/api/moon");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 204);
  EXPECT_EQ(res->get_header_value("Access-Control-Allow-Origin"), "*");
}

// OPTIONS /api/sun returns 204.
TEST(MoonApiCors, OptionsSun) {
  auto cli = NewClient();
  const auto res = cli.Options("/api/sun");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 204);
}

// -----------------------------------------
// ------------ GetMoon ----------------
// -----------------------------------------

// GET /api/moon without required query params returns 400 and an error object.
TEST(MoonApiGetMoon, MissingParams400) {
  auto cli = NewClient();
  const auto res = cli.Get("/api/moon");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 400);
  EXPECT_TRUE(JsonErrorHasMessage(res->body));
}

// Non-numeric lat/lon yields 400.
TEST(MoonApiGetMoon, InvalidLatLon400) {
  auto cli = NewClient();
  const auto res = cli.Get("/api/moon?lat=x&lon=0&date=2024-06-15");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 400);
  EXPECT_TRUE(JsonErrorHasMessage(res->body));
}

// Bad date format yields 400.
TEST(MoonApiGetMoon, InvalidDate400) {
  auto cli = NewClient();
  const auto res = cli.Get("/api/moon?lat=47.6&lon=-122.33&date=06-15-2024");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 400);
  EXPECT_TRUE(JsonErrorHasMessage(res->body));
}

// Invalid optional time yields 400.
TEST(MoonApiGetMoon, InvalidTime400) {
  auto cli = NewClient();
  const auto res = cli.Get("/api/moon?lat=47.6&lon=-122.33&date=2024-06-15&time=25:00");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 400);
  EXPECT_TRUE(JsonErrorHasMessage(res->body));
}

// Coordinates outside allowed ranges yield 400 from handlers after parsing.
TEST(MoonApiGetMoon, LatLonOutOfRange400) {
  auto cli = NewClient();
  const auto res = cli.Get("/api/moon?lat=91&lon=0&date=2024-06-15");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 400);
  EXPECT_TRUE(JsonErrorHasMessage(res->body));
}

// Valid query returns 200 and the documented top-level JSON keys.
TEST(MoonApiGetMoon, Valid200Shape) {
  auto cli = NewClient();
  const auto res =
      cli.Get("/api/moon?lat=47.6&lon=-122.33&date=2024-06-15&time=12:00");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 200);
  const auto j = nlohmann::json::parse(res->body);
  EXPECT_TRUE(j.contains("instant_utc"));
  EXPECT_TRUE(j.contains("location"));
  EXPECT_TRUE(j["location"].contains("latitude"));
  EXPECT_TRUE(j["location"].contains("longitude"));
  EXPECT_TRUE(j.contains("phase"));
  EXPECT_TRUE(j["phase"].contains("name"));
  EXPECT_TRUE(j.contains("illumination"));
  EXPECT_TRUE(j.contains("visibility"));
  EXPECT_TRUE(j["visibility"].contains("state"));
}

// -----------------------------------------
// ------------ GetSun -----------------
// -----------------------------------------

// GET /api/sun with valid params returns 200 and position in degrees.
TEST(MoonApiGetSun, Valid200Shape) {
  auto cli = NewClient();
  const auto res =
      cli.Get("/api/sun?lat=47.6&lon=-122.33&date=2024-06-15&time=12:00");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 200);
  const auto j = nlohmann::json::parse(res->body);
  EXPECT_TRUE(j.contains("instant_utc"));
  EXPECT_TRUE(j.contains("position"));
  EXPECT_TRUE(j["position"].contains("azimuth_deg"));
  EXPECT_TRUE(j["position"].contains("altitude_deg"));
  EXPECT_TRUE(j["position"]["azimuth_deg"].is_number());
  EXPECT_TRUE(j["position"]["altitude_deg"].is_number());
}

// -----------------------------------------
// ------------ PostMoon ---------------
// -----------------------------------------

// Malformed JSON body returns 400.
TEST(MoonApiPostMoon, InvalidJson400) {
  auto cli = NewClient();
  const auto res = cli.Post("/api/moon", "{not json", "application/json");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 400);
  EXPECT_TRUE(JsonErrorHasMessage(res->body));
}

// Missing required JSON keys returns 400.
TEST(MoonApiPostMoon, MissingKeys400) {
  auto cli = NewClient();
  const auto res = cli.Post("/api/moon", R"({"lat":1})", "application/json");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 400);
  EXPECT_TRUE(JsonErrorHasMessage(res->body));
}

// lat/lon must be JSON numbers, not strings.
TEST(MoonApiPostMoon, LatLonMustBeNumbers400) {
  auto cli = NewClient();
  const auto res = cli.Post(
      "/api/moon",
      R"({"lat":"47.6","lon":-122.33,"date":"2024-06-15"})",
      "application/json");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 400);
  EXPECT_TRUE(JsonErrorHasMessage(res->body));
}

// Valid POST returns 200 and same structural keys as GET.
TEST(MoonApiPostMoon, Valid200Shape) {
  auto cli = NewClient();
  const auto res = cli.Post(
      "/api/moon",
      R"({"lat":47.6,"lon":-122.33,"date":"2024-06-15","time":"12:00"})",
      "application/json");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 200);
  const auto j = nlohmann::json::parse(res->body);
  EXPECT_TRUE(j.contains("phase") && j["phase"].contains("cycle_fraction"));
}

// -----------------------------------------
// ------------ PostSun ----------------
// -----------------------------------------

TEST(MoonApiPostSun, Valid200Shape) {
  auto cli = NewClient();
  const auto res = cli.Post(
      "/api/sun",
      R"({"lat":47.6,"lon":-122.33,"date":"2024-06-15","time":"12:00"})",
      "application/json");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 200);
  const auto j = nlohmann::json::parse(res->body);
  EXPECT_TRUE(j.contains("position"));
}

// -----------------------------------------
// ------------ Parity -----------------
// -----------------------------------------

// Equivalent GET and POST parameters yield the same phase cycle_fraction (ephemeris parity).
TEST(MoonApiParity, GetAndPostMoonMatchPhase) {
  auto cli = NewClient();
  const auto r_get = cli.Get(
      "/api/moon?lat=47.6&lon=-122.33&date=2024-06-15&time=12:00");
  const auto r_post = cli.Post(
      "/api/moon",
      R"({"lat":47.6,"lon":-122.33,"date":"2024-06-15","time":"12:00"})",
      "application/json");
  ASSERT_TRUE(r_get && r_post);
  EXPECT_EQ(r_get->status, 200);
  EXPECT_EQ(r_post->status, 200);
  const auto jg = nlohmann::json::parse(r_get->body);
  const auto jp = nlohmann::json::parse(r_post->body);
  EXPECT_NEAR(jg["phase"]["cycle_fraction"].get<double>(),
              jp["phase"]["cycle_fraction"].get<double>(), kEpsFloat);
  EXPECT_EQ(jg["instant_utc"], jp["instant_utc"]);
}

int main(int argc, char** argv) {
  testing::InitGoogleTest(&argc, argv);

  httplib::Server svr;
  register_moon_api_routes(svr);
  std::thread server_thread([&]() { svr.listen(kHost, kPort); });

  bool ready = false;
  for (int i = 0; i < 100; ++i) {
    {
      httplib::Client probe(kHost, kPort);
      probe.set_connection_timeout(0, 200);
      auto r = probe.Get("/api/health");
      if (r && r->status == 200) {
        ready = true;
        break;
      }
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
  if (!ready) {
    svr.stop();
    server_thread.join();
    std::cerr << "moon_api_tests: server failed to start on " << kHost << ":" << kPort << std::endl;
    return 1;
  }

  const int result = RUN_ALL_TESTS();

  svr.stop();
  server_thread.join();
  return result;
}
