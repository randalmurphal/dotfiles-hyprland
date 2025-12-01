cmake_minimum_required(VERSION 3.19)
project(hypr-portal-effect
    VERSION 0.1.0
    DESCRIPTION "Black hole portal effect for window close animations"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# For hyprpm builds, headers are provided via HYPRLAND_HEADERS env var
# For manual builds, try pkg-config or system paths
find_package(PkgConfig)

if(DEFINED ENV{HYPRLAND_HEADERS})
    # hyprpm provides this
    set(HYPRLAND_INCLUDE_DIR $ENV{HYPRLAND_HEADERS})
    message(STATUS "Using HYPRLAND_HEADERS: ${HYPRLAND_INCLUDE_DIR}")
elseif(PkgConfig_FOUND)
    pkg_check_modules(HYPRLAND hyprland)
    if(HYPRLAND_FOUND)
        set(HYPRLAND_INCLUDE_DIR ${HYPRLAND_INCLUDE_DIRS})
    endif()
endif()

if(NOT HYPRLAND_INCLUDE_DIR)
    # Fallback to common locations
    find_path(HYPRLAND_INCLUDE_DIR
        NAMES hyprland/src/plugins/PluginAPI.hpp
        PATHS
            /usr/include
            /usr/local/include
            ${CMAKE_SOURCE_DIR}/../Hyprland/src
    )
endif()

if(NOT HYPRLAND_INCLUDE_DIR)
    message(FATAL_ERROR "Could not find Hyprland headers. Install hyprland-devel or set HYPRLAND_HEADERS")
endif()

message(STATUS "Hyprland headers: ${HYPRLAND_INCLUDE_DIR}")

# Required dependencies
find_package(OpenGL REQUIRED)
pkg_check_modules(PIXMAN REQUIRED pixman-1)
pkg_check_modules(LIBDRM REQUIRED libdrm)
pkg_check_modules(HYPRUTILS REQUIRED hyprutils)
pkg_check_modules(HYPRGRAPHICS REQUIRED hyprgraphics)
pkg_check_modules(HYPRLANG REQUIRED hyprlang)
pkg_check_modules(WAYLAND_SERVER REQUIRED wayland-server)
pkg_check_modules(LIBINPUT REQUIRED libinput)
pkg_check_modules(XKBCOMMON REQUIRED xkbcommon)
pkg_check_modules(PANGO REQUIRED pangocairo)
pkg_check_modules(CAIRO REQUIRED cairo)
pkg_check_modules(GIO REQUIRED gio-2.0)

# Build the shared library
add_library(hypr-portal-effect SHARED
    src/main.cpp
    # src/PortalEffect.cpp  # Disabled for minimal test
)

target_include_directories(hypr-portal-effect PRIVATE
    ${HYPRLAND_INCLUDE_DIR}
    ${PIXMAN_INCLUDE_DIRS}
    ${LIBDRM_INCLUDE_DIRS}
    ${WAYLAND_SERVER_INCLUDE_DIRS}
    ${LIBINPUT_INCLUDE_DIRS}
    ${XKBCOMMON_INCLUDE_DIRS}
    ${PANGO_INCLUDE_DIRS}
    ${CAIRO_INCLUDE_DIRS}
    ${GIO_INCLUDE_DIRS}
    src
)

target_link_libraries(hypr-portal-effect PRIVATE
    OpenGL::GL
    ${HYPRUTILS_LIBRARIES}
    ${HYPRGRAPHICS_LIBRARIES}
    ${HYPRLANG_LIBRARIES}
)

target_compile_definitions(hypr-portal-effect PRIVATE
    WLR_USE_UNSTABLE
)

target_compile_options(hypr-portal-effect PRIVATE
    -Wall -Wextra -Wno-unused-parameter
    -fPIC
    -g -O0  # Debug symbols, no optimization
)

# Install
install(TARGETS hypr-portal-effect
    LIBRARY DESTINATION lib/hyprland/plugins
)
