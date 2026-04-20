// Unit tests for moon:: ephemeris helpers: Julian/unix conversion, parsing, ISO-8601 output,
// lunar illumination and horizon, moonrise/moonset for a UTC day, compute_full, and sun position.

#include "moon_ephemeris.h"

#include <cmath>
#include <set>
#include <string>

#include "gtest/gtest.h"

namespace {

// Floating-point tolerances and the eight phase labels exposed by compute_full.
constexpr double kEpsJd = 1e-9;
constexpr double kEpsTrig = 1e-9;
constexpr double kEpsDeg = 1e-3;

const std::set<std::string> kPhaseNames = {
    "New",           "Waxing Crescent", "First Quarter", "Waxing Gibbous",
    "Full",          "Waning Gibbous",  "Third Quarter", "Waning Crescent",
};

}  // namespace

// -----------------------------------------
// ------------ JulianUnix ------------
// -----------------------------------------

// Unix epoch (1970-01-01 00:00 UTC) maps to the expected Julian date.
TEST(JulianUnix, UnixZeroJulianDate) {
  EXPECT_NEAR(moon::julian_date_from_unix_seconds(0.0), 2440587.5, kEpsJd);
}

// Several Unix timestamps survive julian_date_from_unix_seconds -> unix_seconds_from_julian_date.
TEST(JulianUnix, RoundTripSeconds) {
  const double cases[] = {0.0, 1.0, 123456789.0, 1.7e9};
  for (double sec : cases) {
    const double jd = moon::julian_date_from_unix_seconds(sec);
    const double back = moon::unix_seconds_from_julian_date(jd);
    EXPECT_NEAR(back, sec, 1e-3) << "sec=" << sec;
  }
}

// A fixed Julian day (J2000) round-trips through Unix seconds back to the same JD.
TEST(JulianUnix, RoundTripJulian) {
  const double jd = 2451545.0;  // J2000.0
  const double sec = moon::unix_seconds_from_julian_date(jd);
  const double jd2 = moon::julian_date_from_unix_seconds(sec);
  EXPECT_NEAR(jd2, jd, kEpsJd);
}

// -----------------------------------------
// ------------ ParseDate ------------
// -----------------------------------------

// parse_date accepts typical YYYY-MM-DD strings and boundary years 1900 and 2100.
TEST(ParseDate, AcceptsValidAndBoundaries) {
  int y = 0, m = 0, d = 0;
  EXPECT_TRUE(moon::parse_date("2000-06-15", y, m, d));
  EXPECT_EQ(y, 2000);
  EXPECT_EQ(m, 6);
  EXPECT_EQ(d, 15);

  EXPECT_TRUE(moon::parse_date("1900-01-01", y, m, d));
  EXPECT_EQ(y, 1900);
  EXPECT_TRUE(moon::parse_date("2100-12-31", y, m, d));
  EXPECT_EQ(y, 2100);
}

// parse_date rejects wrong format, out-of-range year, and invalid month/day fields.
TEST(ParseDate, RejectsInvalid) {
  int y = 0, m = 0, d = 0;
  EXPECT_FALSE(moon::parse_date("", y, m, d));
  EXPECT_FALSE(moon::parse_date("2000/06/15", y, m, d));
  EXPECT_FALSE(moon::parse_date("2000-06", y, m, d));
  EXPECT_FALSE(moon::parse_date("1899-01-01", y, m, d));
  EXPECT_FALSE(moon::parse_date("2101-01-01", y, m, d));
  EXPECT_FALSE(moon::parse_date("2000-00-15", y, m, d));
  EXPECT_FALSE(moon::parse_date("2000-13-01", y, m, d));
  EXPECT_FALSE(moon::parse_date("2000-06-00", y, m, d));
  EXPECT_FALSE(moon::parse_date("2000-06-32", y, m, d));
}

// Impossible calendar dates (e.g. Feb 31) still parse: only format and numeric bounds are checked.
TEST(ParseDate, AcceptsImpossibleCalendarDay) {
  int y = 0, m = 0, d = 0;
  EXPECT_TRUE(moon::parse_date("2000-02-31", y, m, d));
  EXPECT_EQ(y, 2000);
  EXPECT_EQ(m, 2);
  EXPECT_EQ(d, 31);
}

// -----------------------------------------
// ------------ ParseTime ------------
// -----------------------------------------

// parse_time_hh_mm accepts HH:MM at min/max valid hours and minutes.
TEST(ParseTime, AcceptsValidAndBoundaries) {
  int hh = 0, mm = 0;
  EXPECT_TRUE(moon::parse_time_hh_mm("00:00", hh, mm));
  EXPECT_EQ(hh, 0);
  EXPECT_EQ(mm, 0);
  EXPECT_TRUE(moon::parse_time_hh_mm("23:59", hh, mm));
  EXPECT_EQ(hh, 23);
  EXPECT_EQ(mm, 59);
  EXPECT_TRUE(moon::parse_time_hh_mm("12:30", hh, mm));
  EXPECT_EQ(hh, 12);
  EXPECT_EQ(mm, 30);
}

// parse_time_hh_mm rejects empty input, partial times, out-of-range hour/minute, and negatives.
TEST(ParseTime, RejectsInvalid) {
  int hh = 0, mm = 0;
  EXPECT_FALSE(moon::parse_time_hh_mm("", hh, mm));
  EXPECT_FALSE(moon::parse_time_hh_mm("12", hh, mm));
  EXPECT_FALSE(moon::parse_time_hh_mm("24:00", hh, mm));
  EXPECT_FALSE(moon::parse_time_hh_mm("12:60", hh, mm));
  EXPECT_FALSE(moon::parse_time_hh_mm("-1:00", hh, mm));
}

// -----------------------------------------
// ----------- Iso8601Utc -----------
// -----------------------------------------

// JD for Unix epoch formats as 1970-01-01T00:00:00Z.
TEST(Iso8601Utc, Epoch) {
  EXPECT_EQ(moon::iso8601_utc_from_jd(2440587.5), "1970-01-01T00:00:00Z");
}

// A known UTC noon (2000-01-01 12:00) round-trips to JD and back to the same ISO-8601 string.
TEST(Iso8601Utc, KnownInstant) {
  const double unix_noon = 946728000.0;  // 2000-01-01 12:00 UTC
  const double jd = moon::julian_date_from_unix_seconds(unix_noon);
  const std::string s = moon::iso8601_utc_from_jd(jd);
  EXPECT_EQ(s, "2000-01-01T12:00:00Z");
}

// -----------------------------------------
// ------- ComputeIllumination -------
// -----------------------------------------

// compute_illumination yields lit fraction and phase in [0,1), finite angle, phase angle in [0,180]°.
TEST(ComputeIllumination, Invariants) {
  const double jds[] = {2451545.0, 2460000.0, 2440587.5};
  for (double jd : jds) {
    const moon::MoonIllumination ill = moon::compute_illumination(jd);
    EXPECT_GE(ill.fraction, 0.0);
    EXPECT_LE(ill.fraction, 1.0);
    EXPECT_GE(ill.phase, 0.0);
    EXPECT_LT(ill.phase, 1.0);
    EXPECT_FALSE(std::isnan(ill.angle));
    EXPECT_FALSE(std::isinf(ill.angle));
    EXPECT_GE(ill.sun_moon_earth_deg, 0.0);
    EXPECT_LE(ill.sun_moon_earth_deg, 180.0);
  }
}

// Illumination changes meaningfully between two different Julian dates (not a flat function).
TEST(ComputeIllumination, NotConstant) {
  const auto a = moon::compute_illumination(2451545.0);
  const auto b = moon::compute_illumination(2451600.0);
  EXPECT_GT(std::fabs(a.fraction - b.fraction), 1e-10);
}

// -----------------------------------------
// ---------- MoonPosition -----------
// -----------------------------------------

// moon_position returns plausible lunar distance (km) and finite azimuth/altitude with rough altitude bounds.
TEST(MoonPosition, Invariants) {
  const double jd = moon::julian_date_from_unix_seconds(1.7e9);
  const moon::MoonHorizon p = moon::moon_position(jd, 47.6, -122.33);
  EXPECT_GT(p.distance, 300000.0);
  EXPECT_LT(p.distance, 500000.0);
  EXPECT_FALSE(std::isnan(p.azimuth));
  EXPECT_FALSE(std::isnan(p.altitude));
  EXPECT_GE(p.altitude, -M_PI / 2.0 - 0.05);
  EXPECT_LE(p.altitude, M_PI / 2.0 + 0.05);
}

// -----------------------------------------
// ------------ MoonTimes ------------
// -----------------------------------------

// For a mid-latitude summer fixture, moonrise/moonset JDs exist and differ (order not guaranteed).
TEST(MoonTimes, MidLatitudeSummerDay) {
  const moon::MoonTimes t = moon::moon_times_for_utc_day(2024, 6, 15, 47.6, -122.33);
  EXPECT_FALSE(t.always_up && t.always_down);
  ASSERT_TRUE(t.rise_jd.has_value());
  ASSERT_TRUE(t.set_jd.has_value());
  EXPECT_NE(*t.rise_jd, *t.set_jd);
}

// Leap day 2024-02-29 computes without error at the same latitude/longitude.
TEST(MoonTimes, LeapDay) {
  const moon::MoonTimes t = moon::moon_times_for_utc_day(2024, 2, 29, 47.6, -122.33);
  (void)t;
  SUCCEED();
}

// Near the pole, if neither rise nor set is found, exactly one of always_up or always_down is set.
TEST(MoonTimes, HighLatitudePolarFlags) {
  const moon::MoonTimes t = moon::moon_times_for_utc_day(2024, 1, 15, 89.0, 0.0);
  if (!t.rise_jd && !t.set_jd) {
    EXPECT_TRUE(t.always_up ^ t.always_down);
  }
}

// -----------------------------------------
// ---------- ComputeFull ------------
// -----------------------------------------

// compute_full reports a known phase name string and illumination fraction in [0,1].
TEST(ComputeFull, PhaseNameIsKnown) {
  const moon::MoonResult r =
      moon::compute_full(2024, 6, 15, 12, 0, 47.6, -122.33);
  EXPECT_TRUE(kPhaseNames.count(r.phase_name) == 1);
  EXPECT_GE(r.illumination.fraction, 0.0);
  EXPECT_LE(r.illumination.fraction, 1.0);
}

// compute_full illumination matches compute_illumination at the same UTC instant (via shared JD).
TEST(ComputeFull, ConsistentWithComponents) {
  const double lat = 47.6, lon = -122.33;
  constexpr double kUnix2024061512Utc = 1718452800.0;
  const double jd = moon::julian_date_from_unix_seconds(kUnix2024061512Utc);

  const moon::MoonIllumination from_full =
      moon::compute_full(2024, 6, 15, 12, 0, lat, lon).illumination;
  const moon::MoonIllumination from_jd = moon::compute_illumination(jd);

  EXPECT_NEAR(from_full.fraction, from_jd.fraction, 1e-9);
  EXPECT_NEAR(from_full.phase, from_jd.phase, 1e-9);
  EXPECT_NEAR(from_full.angle, from_jd.angle, kEpsTrig);
  EXPECT_NEAR(from_full.sun_moon_earth_deg, from_jd.sun_moon_earth_deg, kEpsDeg);
}

// -----------------------------------------
// ---------- SunPosition ------------
// -----------------------------------------

// sun_position returns finite azimuth and altitude in degrees within plausible sky ranges.
TEST(SunPosition, RangeDegrees) {
  const double jd = moon::julian_date_from_unix_seconds(1.7e9);
  const moon::SunHorizon s = moon::sun_position(jd, 47.6, -122.33);
  EXPECT_FALSE(std::isnan(s.azimuth_deg));
  EXPECT_FALSE(std::isnan(s.altitude_deg));
  EXPECT_GE(s.altitude_deg, -90.0 - 0.1);
  EXPECT_LE(s.altitude_deg, 90.0 + 0.1);
  EXPECT_GE(s.azimuth_deg, -180.0 - 0.1);
  EXPECT_LE(s.azimuth_deg, 180.0 + 0.1);
}

// -----------------------------------------
// -------- ComputeSunFull -----------
// -----------------------------------------

// compute_sun_full matches sun_position for the same UTC instant and observer coordinates.
TEST(ComputeSunFull, MatchesSunPosition) {
  const moon::SunResult r = moon::compute_sun_full(2024, 6, 15, 12, 0, 47.6, -122.33);
  const double jd = moon::julian_date_from_unix_seconds(1718452800.0);
  const moon::SunHorizon p = moon::sun_position(jd, 47.6, -122.33);
  EXPECT_NEAR(r.position.azimuth_deg, p.azimuth_deg, kEpsDeg);
  EXPECT_NEAR(r.position.altitude_deg, p.altitude_deg, kEpsDeg);
}
