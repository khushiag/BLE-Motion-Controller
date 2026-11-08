
# Copyright 2026 NXP
#
# SPDX-License-Identifier: BSD-3-Clause

mcux_set_variable(gcc_wireless_linker_file connectivity.ld)

mcux_set_variable(gcc_wireless_linker_file_ble connectivity_ble.ld)

mcux_set_variable(iar_wireless_linker_file connectivity.icf)

mcux_add_cmakelists(${SdkRootDirPath}/middleware/wireless/bluetooth/application/common OPTIONAL)

mcux_add_configuration(
    CC "-DSDK_DEBUGCONSOLE=1"
    CX "-DSDK_DEBUGCONSOLE=1"
)


mcux_add_source(
    SOURCES frdmmcxw71/board.c
            frdmmcxw71/board.h
)

mcux_add_include(
    INCLUDES frdmmcxw71
)

mcux_add_source(
    SOURCES frdmmcxw71/clock_config.c
            frdmmcxw71/clock_config.h
)

mcux_add_include(
    INCLUDES frdmmcxw71
)

mcux_add_source(
    SOURCES read_fxls896x_accel_value_transfer/pin_mux.c
            read_fxls896x_accel_value_transfer/pin_mux.h
)

mcux_add_include(
    INCLUDES read_fxls896x_accel_value_transfer
)

mcux_add_source(
    SOURCES read_fxls896x_accel_value_transfer/app.h
            read_fxls896x_accel_value_transfer/hardware_init.c
)

mcux_add_include(
    INCLUDES read_fxls896x_accel_value_transfer
)
