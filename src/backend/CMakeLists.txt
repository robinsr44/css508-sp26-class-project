cmake_minimum_required(VERSION 3.16)
project(moon-api LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(
  httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG v0.18.3
)
FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.14.0
)
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(httplib json googletest)

add_library(moon_ephemeris STATIC src/moon_ephemeris.cpp)
target_include_directories(moon_ephemeris PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
if(MSVC)
  target_compile_definitions(moon_ephemeris PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()

add_library(moon_api STATIC src/moon_api.cpp)
target_include_directories(moon_api PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src ${httplib_SOURCE_DIR})
target_link_libraries(moon_api PUBLIC moon_ephemeris nlohmann_json::nlohmann_json)
if(MSVC)
  target_compile_definitions(moon_api PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()

add_executable(moon-api src/main.cpp)
target_link_libraries(moon-api PRIVATE moon_api)

if(MSVC)
  target_compile_definitions(moon-api PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()

enable_testing()
add_executable(moon_ephemeris_tests tests/moon_ephemeris_test.cpp)
target_link_libraries(moon_ephemeris_tests PRIVATE moon_ephemeris GTest::gtest_main)
add_test(NAME moon_ephemeris_tests COMMAND moon_ephemeris_tests)

add_executable(moon_api_tests tests/moon_api_test.cpp)
target_link_libraries(moon_api_tests PRIVATE moon_api GTest::gtest)
add_test(NAME moon_api_tests COMMAND moon_api_tests)
