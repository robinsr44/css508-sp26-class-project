// Ephemeris routines adapted from suncalc (BSD-2-Clause, Vladimir Agafonkin)
// https://github.com/mourner/suncalc — low precision, suitable for UI.

#include "moon_ephemeris.h"

#include <algorithm>
#include <optional>
#include <cmath>
#include <cstdio>
#include <ctime>
#include <iomanip>
#include <sstream>

#if defined(_WIN32)
#include <time.h>
#endif

namespace moon {

namespace {

constexpr double PI = 3.14159265358979323846;
constexpr double RAD = PI / 180.0;
constexpr double E = RAD * 23.4397;
constexpr double J2000 = 2451545.0;
constexpr double J1970 = 2440588.0;

inline double to_julian_from_unix(double unix_sec) { return unix_sec / 86400.0 - 0.5 + J1970; }

inline double to_days_from_jd(double jd) { return jd - J2000; }

double jd_from_utc_ymd_hms(int y, int m, int d, int hh, int mm, int ss) {
  std::tm tm{};
  tm.tm_year = y - 1900;
  tm.tm_mon = m - 1;
  tm.tm_mday = d;
  tm.tm_hour = hh;
  tm.tm_min = mm;
  tm.tm_sec = ss;
#if defined(_WIN32)
  time_t t = _mkgmtime(&tm);
#else
  time_t t = timegm(&tm);
#endif
  return to_julian_from_unix(static_cast<double>(t));
}

double right_ascension(double l, double b) {
  return std::atan2(std::sin(l) * std::cos(E) - std::tan(b) * std::sin(E), std::cos(l));
}

double declination(double l, double b) {
  return std::asin(std::sin(b) * std::cos(E) + std::cos(b) * std::sin(E) * std::sin(l));
}

double azimuth(double H, double phi, double dec) {
  return std::atan2(std::sin(H), std::cos(H) * std::sin(phi) - std::tan(dec) * std::cos(phi));
}

double altitude(double H, double phi, double dec) {
  return std::asin(std::sin(phi) * std::sin(dec) + std::cos(phi) * std::cos(dec) * std::cos(H));
}

double sidereal_time(double d, double lw) { return RAD * (280.16 + 360.9856235 * d) - lw; }

double astro_refraction(double h) {
  if (h < 0) h = 0;
  return 0.0002967 / std::tan(h + 0.00312536 / (h + 0.08901179));
}

double solar_mean_anomaly(double d) { return RAD * (357.5291 + 0.98560028 * d); }

double ecliptic_longitude(double M) {
  const double C = RAD * (1.9148 * std::sin(M) + 0.02 * std::sin(2 * M) + 0.0003 * std::sin(3 * M));
  const double P = RAD * 102.9372;
  return M + C + P + PI;
}

struct SunCoords {
  double ra{};
  double dec{};
};

SunCoords sun_coords(double d) {
  const double M = solar_mean_anomaly(d);
  const double L = ecliptic_longitude(M);
  return {right_ascension(L, 0), declination(L, 0)};
}

struct MoonCoords {
  double ra{};
  double dec{};
  double dist{};
};

MoonCoords moon_coords(double d) {
  const double L = RAD * (218.316 + 13.176396 * d);
  const double M = RAD * (134.963 + 13.064993 * d);
  const double F = RAD * (93.272 + 13.229350 * d);
  const double l = L + RAD * 6.289 * std::sin(M);
  const double b = RAD * 5.128 * std::sin(F);
  const double dt = 385001 - 20905 * std::cos(M);
  return {right_ascension(l, b), declination(l, b), dt};
}

static const char* phase_name_from_phase01(double phase01) {
  phase01 = phase01 - std::floor(phase01);
  if (phase01 < 0) phase01 += 1.0;
  const int idx = static_cast<int>(phase01 * 8.0) % 8;
  static const char* names[] = {"New",           "Waxing Crescent", "First Quarter", "Waxing Gibbous",
                                 "Full",          "Waning Gibbous",  "Third Quarter", "Waning Crescent"};
  return names[idx];
}

}  // namespace

double julian_date_from_unix_seconds(double unix_sec) { return to_julian_from_unix(unix_sec); }

double unix_seconds_from_julian_date(double jd) { return (jd + 0.5 - J1970) * 86400.0; }

MoonIllumination compute_illumination(double jd) {
  const double d = to_days_from_jd(jd);
  const SunCoords s = sun_coords(d);
  const MoonCoords m = moon_coords(d);
  constexpr double sdist = 149598000.0;
  const double phi = std::acos(std::clamp(std::sin(s.dec) * std::sin(m.dec) +
                                              std::cos(s.dec) * std::cos(m.dec) * std::cos(s.ra - m.ra),
                                          -1.0, 1.0));
  const double inc = std::atan2(sdist * std::sin(phi), m.dist - sdist * std::cos(phi));
  const double angle = std::atan2(
      std::cos(s.dec) * std::sin(s.ra - m.ra),
      std::sin(s.dec) * std::cos(m.dec) - std::cos(s.dec) * std::sin(m.dec) * std::cos(s.ra - m.ra));
  MoonIllumination out;
  out.fraction = (1.0 + std::cos(inc)) / 2.0;
  out.phase = 0.5 + 0.5 * inc * (angle < 0 ? -1.0 : 1.0) / PI;
  out.phase = out.phase - std::floor(out.phase);
  out.angle = angle;
  out.sun_moon_earth_deg = inc * (180.0 / PI);
  return out;
}

MoonHorizon moon_position(double jd, double lat_deg, double lon_deg) {
  const double lw = RAD * -lon_deg;
  const double phi = RAD * lat_deg;
  const double d = to_days_from_jd(jd);
  const MoonCoords c = moon_coords(d);
  const double H = sidereal_time(d, lw) - c.ra;
  double h = altitude(H, phi, c.dec);
  h += astro_refraction(h);
  return {azimuth(H, phi, c.dec), h, c.dist};
}

static double hours_later_jd(double jd, double hours) { return jd + hours / 24.0; }

MoonTimes moon_times_for_utc_day(int year, int month, int day, double lat_deg, double lon_deg) {
  const double jd0 = jd_from_utc_ymd_hms(year, month, day, 0, 0, 0);

  const double hc = 0.133 * RAD;
  double h0 = moon_position(jd0, lat_deg, lon_deg).altitude - hc;
  std::optional<double> rise_h;
  std::optional<double> set_h;
  double ye = 0;

  for (int i = 1; i <= 24; i += 2) {
    const double h1 = moon_position(hours_later_jd(jd0, static_cast<double>(i)), lat_deg, lon_deg).altitude - hc;
    const double h2 =
        moon_position(hours_later_jd(jd0, static_cast<double>(i + 1)), lat_deg, lon_deg).altitude - hc;
    const double a = (h0 + h2) / 2.0 - h1;
    const double b = (h2 - h0) / 2.0;
    const double xe = (std::abs(a) < 1e-12) ? 0.0 : -b / (2.0 * a);
    const double disc = b * b - 4.0 * a * h1;
    int roots = 0;
    double x1 = 0, x2 = 0;
    ye = (a * xe + b) * xe + h1;

    if (disc >= 0.0 && std::abs(a) > 1e-12) {
      const double dx = std::sqrt(disc) / (std::abs(a) * 2.0);
      x1 = xe - dx;
      x2 = xe + dx;
      if (std::abs(x1) <= 1) roots++;
      if (std::abs(x2) <= 1) roots++;
      if (x1 < -1) x1 = x2;
    }

    if (roots == 1) {
      if (h0 < 0) rise_h = static_cast<double>(i) + x1;
      else set_h = static_cast<double>(i) + x1;
    } else if (roots == 2) {
      rise_h = static_cast<double>(i) + (ye < 0 ? x2 : x1);
      set_h = static_cast<double>(i) + (ye < 0 ? x1 : x2);
    }

    if (rise_h && set_h) break;
    h0 = h2;
  }

  MoonTimes out;
  if (rise_h) out.rise_jd = hours_later_jd(jd0, *rise_h);
  if (set_h) out.set_jd = hours_later_jd(jd0, *set_h);
  if (!rise_h && !set_h) {
    if (ye > 0) out.always_up = true;
    else out.always_down = true;
  }
  return out;
}

bool parse_date(const std::string& ymd, int& y, int& m, int& d) {
  if (std::sscanf(ymd.c_str(), "%d-%d-%d", &y, &m, &d) != 3) return false;
  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

bool parse_time_hh_mm(const std::string& hm, int& hh, int& mm) {
  if (hm.empty()) return false;
  if (std::sscanf(hm.c_str(), "%d:%d", &hh, &mm) != 2) return false;
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

std::string iso8601_utc_from_jd(double jd) {
  const double sec = unix_seconds_from_julian_date(jd);
  const time_t t = static_cast<time_t>(std::floor(sec + 0.5));
  std::tm tm{};
#if defined(_WIN32)
  gmtime_s(&tm, &t);
#else
  gmtime_r(&t, &tm);
#endif
  std::ostringstream oss;
  oss << std::setfill('0') << std::setw(4) << (tm.tm_year + 1900) << '-' << std::setw(2) << (tm.tm_mon + 1)
      << '-' << std::setw(2) << tm.tm_mday << 'T' << std::setw(2) << tm.tm_hour << ':' << std::setw(2)
      << tm.tm_min << ':' << std::setw(2) << tm.tm_sec << 'Z';
  return oss.str();
}

MoonResult compute_full(int year, int month, int day, int hour_utc, int minute_utc, double lat_deg,
                        double lon_deg) {
  const double jd = jd_from_utc_ymd_hms(year, month, day, hour_utc, minute_utc, 0);
  MoonResult r;
  r.illumination = compute_illumination(jd);
  r.phase_name = phase_name_from_phase01(r.illumination.phase);
  r.times = moon_times_for_utc_day(year, month, day, lat_deg, lon_deg);
  return r;
}

SunHorizon sun_position(double jd, double lat_deg, double lon_deg) {
  const double lw = RAD * -lon_deg;
  const double phi = RAD * lat_deg;
  const double d = to_days_from_jd(jd);
  const SunCoords c = sun_coords(d);
  const double H = sidereal_time(d, lw) - c.ra;
  double h = altitude(H, phi, c.dec);
  h += astro_refraction(h);
  const double az = azimuth(H, phi, c.dec);
  constexpr double deg = 180.0 / PI;
  return {az * deg, h * deg};
}

SunResult compute_sun_full(int year, int month, int day, int hour_utc, int minute_utc, double lat_deg,
                           double lon_deg) {
  const double jd = jd_from_utc_ymd_hms(year, month, day, hour_utc, minute_utc, 0);
  SunResult r;
  r.position = sun_position(jd, lat_deg, lon_deg);
  return r;
}

}  // namespace moon
