#pragma once

#include <optional>
#include <string>

namespace moon {

struct MoonIllumination {
  double fraction{};              // 0..1 lit
  double phase{};                 // 0..1 position in cycle (suncalc convention)
  double angle{};                 // orientation angle (radians)
  double sun_moon_earth_deg{};    // phase angle i (degrees), astronomical meaning
};

struct MoonHorizon {
  double azimuth{};
  double altitude{};  // radians, includes refraction correction
  double distance{};  // km
};

struct MoonTimes {
  std::optional<double> rise_jd;
  std::optional<double> set_jd;
  bool always_up{};
  bool always_down{};
};

struct MoonResult {
  MoonIllumination illumination;
  std::string phase_name;
  MoonTimes times;
};

MoonIllumination compute_illumination(double jd);

MoonHorizon moon_position(double jd, double lat_deg, double lon_deg);

MoonTimes moon_times_for_utc_day(int year, int month, int day, double lat_deg, double lon_deg);

double julian_date_from_unix_seconds(double unix_sec);
double unix_seconds_from_julian_date(double jd);

bool parse_date(const std::string& ymd, int& y, int& m, int& d);
bool parse_time_hh_mm(const std::string& hm, int& hh, int& mm);

std::string iso8601_utc_from_jd(double jd);

MoonResult compute_full(int year, int month, int day, int hour_utc, int minute_utc, double lat_deg,
                        double lon_deg);

}  // namespace moon
