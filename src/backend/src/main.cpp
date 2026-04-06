#include <httplib.h>
#include <nlohmann/json.hpp>

#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <string>

#include "moon_ephemeris.h"

static void set_cors(httplib::Response& res) {
  res.set_header("Access-Control-Allow-Origin", "*");
  res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

static bool parse_double(const std::string& s, double& out) {
  char* end = nullptr;
  out = std::strtod(s.c_str(), &end);
  return end != s.c_str() && *end == '\0';
}

static nlohmann::json build_json(const moon::MoonResult& r, int y, int m, int d, int hh, int mm, double lat,
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

static void handle_moon(double lat, double lon, int y, int m, int d, int hh, int mm, httplib::Response& res) {
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

int main(int argc, char** argv) {
  int port = 8080;
  if (argc >= 2) port = std::atoi(argv[1]);

  httplib::Server svr;

  svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
    res.set_content(R"({"status":"ok"})", "application/json");
    set_cors(res);
  });

  auto cors_options = [](const httplib::Request&, httplib::Response& res) {
    res.status = 204;
    set_cors(res);
  };
  svr.Options("/api/moon", cors_options);
  svr.Options("/api/health", cors_options);

  svr.Get("/api/moon", [](const httplib::Request& req, httplib::Response& res) {
    const auto lat_it = req.params.find("lat");
    const auto lon_it = req.params.find("lon");
    const auto date_it = req.params.find("date");
    if (lat_it == req.params.end() || lon_it == req.params.end() || date_it == req.params.end()) {
      res.status = 400;
      // Custom delimiter: R"(...)" breaks — `12:00)"` terminates the raw string early.
      res.set_content(
          R"ERR({"error":"required query params: lat, lon, date (YYYY-MM-DD); optional: time (HH:MM UTC, default 12:00)"})ERR",
          "application/json");
      set_cors(res);
      return;
    }
    double lat = 0, lon = 0;
    if (!parse_double(lat_it->second, lat) || !parse_double(lon_it->second, lon)) {
      res.status = 400;
      res.set_content(R"({"error":"lat and lon must be numbers"})", "application/json");
      set_cors(res);
      return;
    }
    int y = 0, m = 0, d = 0;
    if (!moon::parse_date(date_it->second, y, m, d)) {
      res.status = 400;
      res.set_content(R"({"error":"date must be YYYY-MM-DD"})", "application/json");
      set_cors(res);
      return;
    }
    int hh = 12;
    int mm = 0;
    const auto time_it = req.params.find("time");
    if (time_it != req.params.end()) {
      if (!moon::parse_time_hh_mm(time_it->second, hh, mm)) {
        res.status = 400;
        res.set_content(R"({"error":"time must be HH:MM in UTC"})", "application/json");
        set_cors(res);
        return;
      }
    }
    handle_moon(lat, lon, y, m, d, hh, mm, res);
  });

  svr.Post("/api/moon", [](const httplib::Request& req, httplib::Response& res) {
    nlohmann::json body;
    try {
      body = nlohmann::json::parse(req.body.empty() ? "{}" : req.body);
    } catch (...) {
      res.status = 400;
      res.set_content(R"({"error":"invalid JSON"})", "application/json");
      set_cors(res);
      return;
    }
    if (!body.contains("lat") || !body.contains("lon") || !body.contains("date")) {
      res.status = 400;
      res.set_content(R"({"error":"JSON must include lat, lon, date"})", "application/json");
      set_cors(res);
      return;
    }
    double lat = 0, lon = 0;
    if (!body["lat"].is_number() || !body["lon"].is_number()) {
      res.status = 400;
      res.set_content(R"({"error":"lat and lon must be numbers"})", "application/json");
      set_cors(res);
      return;
    }
    lat = body["lat"].get<double>();
    lon = body["lon"].get<double>();
    const std::string date_str = body["date"].get<std::string>();
    int y = 0, m = 0, dday = 0;
    if (!moon::parse_date(date_str, y, m, dday)) {
      res.status = 400;
      res.set_content(R"({"error":"date must be YYYY-MM-DD"})", "application/json");
      set_cors(res);
      return;
    }
    int hh = 12;
    int mm = 0;
    if (body.contains("time") && body["time"].is_string()) {
      if (!moon::parse_time_hh_mm(body["time"].get<std::string>(), hh, mm)) {
        res.status = 400;
        res.set_content(R"({"error":"time must be HH:MM in UTC"})", "application/json");
        set_cors(res);
        return;
      }
    }
    handle_moon(lat, lon, y, m, dday, hh, mm, res);
  });

  std::cout << "moon-api listening on http://0.0.0.0:" << port << std::endl;
  if (!svr.listen("0.0.0.0", port)) {
    std::cerr << "failed to listen on port " << port << std::endl;
    return 1;
  }
  return 0;
}
