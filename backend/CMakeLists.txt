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
FetchContent_MakeAvailable(httplib json)

add_executable(moon-api
  src/main.cpp
  src/moon_ephemeris.cpp
)
target_include_directories(moon-api PRIVATE ${httplib_SOURCE_DIR})
target_link_libraries(moon-api PRIVATE nlohmann_json::nlohmann_json)

if(MSVC)
  target_compile_definitions(moon-api PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()
