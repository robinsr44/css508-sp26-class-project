# CMake generated Testfile for 
# Source directory: /Users/robinroston/workspace/css508-sp26-class-project/src/backend
# Build directory: /Users/robinroston/workspace/css508-sp26-class-project/build-ci-test
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
add_test(moon_ephemeris_tests "/Users/robinroston/workspace/css508-sp26-class-project/build-ci-test/moon_ephemeris_tests")
set_tests_properties(moon_ephemeris_tests PROPERTIES  _BACKTRACE_TRIPLES "/Users/robinroston/workspace/css508-sp26-class-project/src/backend/CMakeLists.txt;49;add_test;/Users/robinroston/workspace/css508-sp26-class-project/src/backend/CMakeLists.txt;0;")
add_test(moon_api_tests "/Users/robinroston/workspace/css508-sp26-class-project/build-ci-test/moon_api_tests")
set_tests_properties(moon_api_tests PROPERTIES  _BACKTRACE_TRIPLES "/Users/robinroston/workspace/css508-sp26-class-project/src/backend/CMakeLists.txt;53;add_test;/Users/robinroston/workspace/css508-sp26-class-project/src/backend/CMakeLists.txt;0;")
subdirs("_deps/httplib-build")
subdirs("_deps/json-build")
subdirs("_deps/googletest-build")
