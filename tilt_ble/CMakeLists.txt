
# Copyright 2026 NXP
#
# SPDX-License-Identifier: BSD-3-Clause

cmake_minimum_required(VERSION 3.22.0)

cmake_path(APPEND conf_file_path ${CMAKE_CURRENT_LIST_DIR} ${board} prj.conf)
set(CONF_FILE ${conf_file_path} ${CONF_FILE})
include(${SdkRootDirPath}/cmake/extension/mcux.cmake)

project(tilt_ble LANGUAGES C CXX ASM
    PROJECT_BOARD_PORT_PATH ${board_root}/${board}/wireless_examples
    CUSTOM_PRJ_CONF_PATH ${board_root}/${board}/wireless_examples/bluetooth/
        ${board_root}/${board}/wireless_examples/bluetooth/w_uart/${core_id}/bm
)

include(${SdkRootDirPath}/CMakeLists.txt)


include(${board}/board_files.cmake)
mcux_remove_armgcc_configuration(
    TARGETS debug
    CC "-O0"
    CX "-O0"
)

mcux_add_armgcc_configuration(
    TARGETS debug
    CC "-Og"
    CX "-Og"
)


mcux_add_source(
    SOURCES frdmmcxw71/app_preinclude_common.h
)

mcux_add_include(
    INCLUDES frdmmcxw71
)

mcux_add_source(
    SOURCES bluetooth_w_uart/example_board_readme.md
            bluetooth_w_uart/readme.md
            bm/main.c
            common/app_advertiser.c
            common/app_advertiser.h
            common/app_conn.c
            common/app_conn.h
            common/app_connection.c
            common/app_nvm.c
            common/app_scanner.c
            common/app_scanner.h
            common/ble_init.c
            common/ble_init.h
            w_uart/app_config.c
            w_uart/gatt_db.h
            w_uart/gatt_uuid128.h
            w_uart/wireless_uart.c
            w_uart/wireless_uart.h
            w_uart/accel.c
            w_uart/accel.h
)

mcux_add_include(
    INCLUDES common
             w_uart
)

mcux_add_source(
    PREINCLUDE TRUE
    SOURCES bluetooth_w_uart/app_preinclude.h
)
mcux_add_configuration(
    CC "-DSERIAL_USE_CONFIGURE_STRUCTURE=1\
       -DgButtonSupported_d=1\
       -DSDK_DEBUGCONSOLE=2\
       -DOSA_USED\
       -DSDK_DEBUGCONSOLE_UART\
       -DSDK_COMPONENT_INTEGRATION=1\
       -DFSL_OSA_TASK_ENABLE=1\
       -DCR_INTEGER_PRINTF\
       -DMCXW716C\
       -DCPU_MCXW716CMFTA\
       -DCFG_BLE_PRJ=1\
       -DENABLE_RAM_VECTOR_TABLE=1\
       -DNXP_SSSAPI\
       -DNXP_ELE200\
       -DHAL_FLASH_ROMAPI_DRIVER=1\
       -DgUseHciTransportDownward_d=1\
       -DTM_ENABLE_TIME_STAMP=1"
)

mcux_add_iar_configuration(
    CX "--diag_suppress Pa082,Pa050"
    LD "--config_def=gUseNVMLink_d=1\
       --config_def=gEraseNVMLink_d=1\
       --config_def=__ram_vector_table__=1\
       --config_def=gFlashNbuImage_d=1\
       --config_def=gUseProdInfoLegacyMode_d=1\
       --config_def=__use_shmem__=1"
)

mcux_add_armgcc_configuration(
    LD "-Xlinker --defsym=gUseNVMLink_d=1\
        -Xlinker --defsym=gEraseNVMLink_d=1\
        -Xlinker --defsym=__ram_vector_table__=1\
        -Xlinker --defsym=gFlashNbuImage_d=1\
        -Xlinker --defsym=gUseProdInfoLegacyMode_d=1\
        -Xlinker --defsym=__use_shmem__=1"
)
mcux_convert_binary(
        TOOLCHAINS armgcc iar
        BINARY ${APPLICATION_BINARY_DIR}/${CONFIG_TOOLCHAIN}/wireless_uart_${board}.srec
)


mcux_add_include(INCLUDES bluetooth_w_uart bm)
