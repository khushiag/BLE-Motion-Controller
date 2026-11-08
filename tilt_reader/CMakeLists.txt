
# Copyright 2026 NXP
#
# SPDX-License-Identifier: BSD-3-Clause

cmake_minimum_required(VERSION 3.22.0)

cmake_path(APPEND conf_file_path ${CMAKE_CURRENT_LIST_DIR} ${board} prj.conf)
set(CONF_FILE ${conf_file_path} ${CONF_FILE})
include(${SdkRootDirPath}/cmake/extension/mcux.cmake)

project(tilt_reader LANGUAGES C CXX ASM PROJECT_BOARD_PORT_PATH ${board_root}/${board}/driver_examples/lpi2c/read_fxls896x_accel_value_transfer)

include(${SdkRootDirPath}/CMakeLists.txt)


include(${board}/board_files.cmake)

mcux_add_source(
    SOURCES lpi2c_read_fxls896x_accel_value_transfer.c
)

mcux_add_include(
    INCLUDES read_fxls896x_accel_value_transfer
)
mcux_add_macro(
    CC "-DPRINTF_ADVANCED_ENABLE=1"
)

mcux_convert_binary(BINARY ${APPLICATION_BINARY_DIR}/${MCUX_SDK_PROJECT_NAME}.bin)

mcux_add_include(INCLUDES .)
