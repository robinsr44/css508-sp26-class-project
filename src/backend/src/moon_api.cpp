#include "moon_api.h"

#include <nlohmann/json.hpp>

#include <cstdio>
#include <string>

#include "moon_ephemeris.h"

namespace {

constexpr const char* kApiVersion = "1.1.0";

void set_cors(httplib::Response& res) {
  res.set_header("Access-Control-Allow-Origin", "*");
  res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

bool parse_double(const std::string& s, double& out) {
  char* end = nullptr;
  out = std::strtod(s.c_str(), &end);
  return end != s.c_str() && *end == '\0';
}

nlohmann::json build_json(const moon::MoonResult& r, int y, int m, int d, int hh, int mm, double lat,
                            double lon) {
  nlohmann::json j;
  char instant[40];
  std::snprintf(instant, sizeof(instant), "%04d-%02d-%02dT%02d:%02d:00Z", y, m, d, hh, mm);
  j["instant_utc"] = instant;
  j["location"] = {{"latitude", lat}, {"longitude", lon}};
  j["phase"] = {{"name", r.phase_name},
                {"cycle_fraction", r.illumination.phase},
                {"sun_moon_earth_angle_deg", r.illumination.sun_moon_earth_deg}};
  j["illumination"] = {{"fraction", r.illumination.fraction}, {"percent", r.illumination.fraction * 100.0}};
  auto& vis = j["visibility"] = nlohmann::json::object();
  if (r.times.always_up) {
    vis["state"] = "always_up";
  } else if (r.times.always_down) {
    vis["state"] = "always_down";
  } else {
    vis["state"] = "normal";
    if (r.times.rise_jd) vis["moonrise_utc"] = moon::iso8601_utc_from_jd(*r.times.rise_jd);
    if (r.times.set_jd) vis["moonset_utc"] = moon::iso8601_utc_from_jd(*r.times.set_jd);
    if (r.times.rise_jd && r.times.set_jd) {
      const double span_hours = (*r.times.set_jd - *r.times.rise_jd) * 24.0;
      vis["hours_above_horizon"] = span_hours >= 0 ? span_hours : -span_hours;
    }
  }
  return j;
}

void handle_moon(double lat, double lon, int y, int m, int d, int hh, int mm, httplib::Response& res) {
  if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
    res.status = 400;
    res.set_content(R"({"error":"lat must be in [-90,90] and lon in [-180,180]"})", "application/json");
    set_cors(res);
    return;
  }
  moon::MoonResult result = moon::compute_full(y, m, d, hh, mm, lat, lon);
  nlohmann::json j = build_json(result, y, m, d, hh, mm, lat, lon);
  res.set_content(j.dump(), "application/json");
  set_cors(res);
}

nlohmann::json build_sun_json(const moon::SunResult& r, int y, int m, int d, int hh, int mm, double lat,
                              double lon) {
  nlohmann::json j;
  char instant[40];
  std::snprintf(instant, sizeof(instant), "%04d-%02d-%02dT%02d:%02d:00Z", y, m, d, hh, mm);
  j["instant_utc"] = instant;
  j["location"] = {{"latitude", lat}, {"longitude", lon}};
  j["position"] = {{"azimuth_deg", r.position.azimuth_deg}, {"altitude_deg", r.position.altitude_deg}};
  return j;
}

void handle_sun(double lat, double lon, int y, int m, int d, int hh, int mm, httplib::Response& res) {
  if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
    res.status = 400;
    res.set_content(R"({"error":"lat must be in [-90,90] and lon in [-180,180]"})", "application/json");
    set_cors(res);
    return;
  }
  moon::SunResult result = moon::compute_sun_full(y, m, d, hh, mm, lat, lon);
  nlohmann::json j = build_sun_json(result, y, m, d, hh, mm, lat, lon);
  res.set_content(j.dump(), "application/json");
  set_cors(res);
}

// Parses shared GET query params for /api/moon and /api/sun. On failure, sets res and CORS; returns false.
bool parse_get_moon_sun_params(const httplib::Request& req, httplib::Response& res, double& lat, double& lon,
                               int& y, int& m, int& d, int& hh, int& mm) {
  const auto lat_it = req.params.find("lat");
  const auto lon_it = req.params.find("lon");
  const auto date_it = req.params.find("date");
  if (lat_it == req.params.end() || lon_it == req.params.end() || date_it == req.params.end()) {
    res.status = 400;
    res.set_content(
        R"ERR({"error":"required query params: lat, lon, date (YYYY-MM-DD); optional: time (HH:MM UTC, default 12:00)"})ERR",
        "application/json");
    set_cors(res);
    return false;
  }
  if (!parse_double(lat_it->second, lat) || !parse_double(lon_it->second, lon)) {
    res.status = 400;
    res.set_content(R"({"error":"lat and lon must be numbers"})", "application/json");
    set_cors(res);
    return false;
  }
  if (!moon::parse_date(date_it->second, y, m, d)) {
    res.status = 400;
    res.set_content(R"({"error":"date must be YYYY-MM-DD"})", "application/json");
    set_cors(res);
    return false;
  }
  hh = 12;
  mm = 0;
  const auto time_it = req.params.find("time");
  if (time_it != req.params.end()) {
    if (!moon::parse_time_hh_mm(time_it->second, hh, mm)) {
      res.status = 400;
      res.set_content(R"({"error":"time must be HH:MM in UTC"})", "application/json");
      set_cors(res);
      return false;
    }
  }
  return true;
}

// Parses shared JSON body for POST /api/moon and POST /api/sun. On failure, sets res and CORS; returns false.
bool parse_post_moon_sun_body(const httplib::Request& req, httplib::Response& res, double& lat, double& lon,
                              int& y, int& m, int& d, int& hh, int& mm) {
  nlohmann::json body;
  try {
    body = nlohmann::json::parse(req.body.empty() ? "{}" : req.body);
  } catch (...) {
    res.status = 400;
    res.set_content(R"({"error":"invalid JSON"})", "application/json");
    set_cors(res);
    return false;
  }
  if (!body.contains("lat") || !body.contains("lon") || !body.contains("date")) {
    res.status = 400;
    res.set_content(R"({"error":"JSON must include lat, lon, date"})", "application/json");
    set_cors(res);
    return false;
  }
  if (!body["lat"].is_number() || !body["lon"].is_number()) {
    res.status = 400;
    res.set_content(R"({"error":"lat and lon must be numbers"})", "application/json");
    set_cors(res);
    return false;
  }
  lat = body["lat"].get<double>();
  lon = body["lon"].get<double>();
  const std::string date_str = body["date"].get<std::string>();
  if (!moon::parse_date(date_str, y, m, d)) {
    res.status = 400;
    res.set_content(R"({"error":"date must be YYYY-MM-DD"})", "application/json");
    set_cors(res);
    return false;
  }
  hh = 12;
  mm = 0;
  if (body.contains("time") && body["time"].is_string()) {
    if (!moon::parse_time_hh_mm(body["time"].get<std::string>(), hh, mm)) {
      res.status = 400;
      res.set_content(R"({"error":"time must be HH:MM in UTC"})", "application/json");
      set_cors(res);
      return false;
    }
  }
  return true;
}

}  // namespace

void register_moon_api_routes(httplib::Server& svr) {
  svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
    res.set_content(R"({"status":"ok"})", "application/json");
    set_cors(res);
  });

  svr.Get("/api/version", [](const httplib::Request&, httplib::Response& res) {
    nlohmann::json j;
    j["version"] = kApiVersion;
    j["service"] = "moon-api";
    res.set_content(j.dump(), "application/json");
    set_cors(res);
  });

  auto cors_options = [](const httplib::Request&, httplib::Response& res) {
    res.status = 204;
    set_cors(res);
  };
  svr.Options("/api/moon", cors_options);
  svr.Options("/api/sun", cors_options);
  svr.Options("/api/health", cors_options);
  svr.Options("/api/version", cors_options);

  svr.Get("/api/moon", [](const httplib::Request& req, httplib::Response& res) {
    double lat = 0, lon = 0;
    int y = 0, m = 0, d = 0, hh = 12, mm = 0;
    if (!parse_get_moon_sun_params(req, res, lat, lon, y, m, d, hh, mm)) return;
    handle_moon(lat, lon, y, m, d, hh, mm, res);
  });

  svr.Get("/api/sun", [](const httplib::Request& req, httplib::Response& res) {
    double lat = 0, lon = 0;
    int y = 0, m = 0, d = 0, hh = 12, mm = 0;
    if (!parse_get_moon_sun_params(req, res, lat, lon, y, m, d, hh, mm)) return;
    handle_sun(lat, lon, y, m, d, hh, mm, res);
  });

  svr.Post("/api/moon", [](const httplib::Request& req, httplib::Response& res) {
    double lat = 0, lon = 0;
    int y = 0, m = 0, d = 0, hh = 12, mm = 0;
    if (!parse_post_moon_sun_body(req, res, lat, lon, y, m, d, hh, mm)) return;
    handle_moon(lat, lon, y, m, d, hh, mm, res);
  });

  svr.Post("/api/sun", [](const httplib::Request& req, httplib::Response& res) {
    double lat = 0, lon = 0;
    int y = 0, m = 0, d = 0, hh = 12, mm = 0;
    if (!parse_post_moon_sun_body(req, res, lat, lon, y, m, d, hh, mm)) return;
    handle_sun(lat, lon, y, m, d, hh, mm, res);
  });
}
