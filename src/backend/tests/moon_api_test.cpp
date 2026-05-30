// HTTP-level tests for register_moon_api_routes: health, version, CORS, GET/POST /api/moon and /api/sun,
// validation errors (400), and JSON response shape. Server runs on 127.0.0.1 in a background thread.
//
// TestPlan / TestStrategy mapping (moon_api_tests):
//   HTTP-01 — MoonApiHealth.GetOk
//   HTTP-02 — MoonApiVersion.GetHasServiceAndVersion
//   HTTP-03 — MoonApiGetMoon.Valid200Shape
//   HTTP-04 — MoonApiPostMoon.Valid200Shape, MoonApiParity.GetAndPostMoonMatchPhase,
//             MoonApiParity.GetAndPostSunMatchPosition, MoonApiGetMoon.DefaultTimeMatchesExplicitNoon
//   HTTP-05 — MoonApiGetSun.Valid200Shape, MoonApiPostSun.Valid200Shape
//   HTTP-06 — MoonApiGetMoon.MissingParams400
//   HTTP-07 — LatLonOutOfRange400, InvalidLatLon400, Post lat/lon type errors
//   HTTP-08 — InvalidDate400, InvalidTime400, Post JSON/body validation
//   HTTP-09 — MoonApiCors.Options*

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

// OPTIONS /api/health returns 204 and CORS headers.
TEST(MoonApiCors, OptionsHealth) {
  auto cli = NewClient();
  const auto res = cli.Options("/api/health");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 204);
  EXPECT_EQ(res->get_header_value("Access-Control-Allow-Origin"), "*");
}

// OPTIONS /api/version returns 204 and CORS headers.
TEST(MoonApiCors, OptionsVersion) {
  auto cli = NewClient();
  const auto res = cli.Options("/api/version");
  ASSERT_TRUE(res);
  EXPECT_EQ(res->status, 204);
  EXPECT_EQ(res->get_header_value("Access-Control-Allow-Origin"), "*");
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

// Normal visibility: when both moonrise and moonset are present, hours_above_horizon is included.
TEST(MoonApiGetMoon, NormalVisibilityHoursAboveHorizonWhenRiseAndSet) {
  auto cli = NewClient();
  const auto res =
      cli.Get("/api/moon?lat=47.6&lon=-122.33&date=2024-06-15&time=12:00");
  ASSERT_TRUE(res);
  ASSERT_EQ(res->status, 200);
  const auto j = nlohmann::json::parse(res->body);
  ASSERT_EQ(j["visibility"]["state"], "normal");
  if (j["visibility"].contains("moonrise_utc") && j["visibility"].contains("moonset_utc")) {
    EXPECT_TRUE(j["visibility"].contains("hours_above_horizon"));
    EXPECT_TRUE(j["visibility"]["hours_above_horizon"].is_number());
  }
}

// High latitude: visibility.state is valid; always_up / always_down responses omit rise/set and hours.
TEST(MoonApiGetMoon, PolarVisibilityShape) {
  auto cli = NewClient();
  const auto res =
      cli.Get("/api/moon?lat=89&lon=0&date=2024-01-15&time=12:00");
  ASSERT_TRUE(res);
  ASSERT_EQ(res->status, 200);
  const auto j = nlohmann::json::parse(res->body);
  const std::string st = j["visibility"]["state"].get<std::string>();
  EXPECT_TRUE(st == "normal" || st == "always_up" || st == "always_down");
  if (st == "always_up" || st == "always_down") {
    EXPECT_FALSE(j["visibility"].contains("moonrise_utc"));
    EXPECT_FALSE(j["visibility"].contains("moonset_utc"));
    EXPECT_FALSE(j["visibility"].contains("hours_above_horizon"));
  }
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

// POST body date must be a JSON string (not a number).
TEST(MoonApiPostMoon, DateMustBeString400) {
  auto cli = NewClient();
  const auto res = cli.Post(
      "/api/moon",
      R"({"lat":0,"lon":0,"date":20240615})",
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

// Omitted time query param defaults to 12:00 UTC (same instant as explicit time=12:00).
TEST(MoonApiGetMoon, DefaultTimeMatchesExplicitNoon) {
  auto cli = NewClient();
  const auto r_default = cli.Get("/api/moon?lat=47.6&lon=-122.33&date=2024-06-15");
  const auto r_noon = cli.Get("/api/moon?lat=47.6&lon=-122.33&date=2024-06-15&time=12:00");
  ASSERT_TRUE(r_default && r_noon);
  EXPECT_EQ(r_default->status, 200);
  EXPECT_EQ(r_noon->status, 200);
  const auto j0 = nlohmann::json::parse(r_default->body);
  const auto j1 = nlohmann::json::parse(r_noon->body);
  EXPECT_EQ(j0["instant_utc"], j1["instant_utc"]);
  EXPECT_NEAR(j0["phase"]["cycle_fraction"].get<double>(),
              j1["phase"]["cycle_fraction"].get<double>(), kEpsFloat);
}

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

// Equivalent GET and POST sun parameters yield the same position (ephemeris parity).
TEST(MoonApiParity, GetAndPostSunMatchPosition) {
  auto cli = NewClient();
  const auto r_get = cli.Get("/api/sun?lat=47.6&lon=-122.33&date=2024-06-15&time=12:00");
  const auto r_post = cli.Post(
      "/api/sun",
      R"({"lat":47.6,"lon":-122.33,"date":"2024-06-15","time":"12:00"})",
      "application/json");
  ASSERT_TRUE(r_get && r_post);
  EXPECT_EQ(r_get->status, 200);
  EXPECT_EQ(r_post->status, 200);
  const auto jg = nlohmann::json::parse(r_get->body);
  const auto jp = nlohmann::json::parse(r_post->body);
  EXPECT_NEAR(jg["position"]["azimuth_deg"].get<double>(),
              jp["position"]["azimuth_deg"].get<double>(), kEpsFloat);
  EXPECT_NEAR(jg["position"]["altitude_deg"].get<double>(),
              jp["position"]["altitude_deg"].get<double>(), kEpsFloat);
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
