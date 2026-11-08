
# Copyright 2026 NXP
#
# SPDX-License-Identifier: BSD-3-Clause


mcux_add_source(
    SOURCES wireless_examples/clock_config.c
            wireless_examples/clock_config.h
)

mcux_add_include(
    INCLUDES wireless_examples
)

mcux_add_source(
    SOURCES wireless_examples/board_platform.h
            wireless_examples/pin_mux_lp.h
            wireless_mcu/board.c
            wireless_mcu/board.h
)

mcux_add_include(
    INCLUDES wireless_mcu
)

mcux_add_source(
    SOURCES components/board_comp.c
            components/board_comp.h
)

mcux_add_include(
    INCLUDES components
)

mcux_add_source(
    SOURCES dcdc/board_dcdc.c
            dcdc/board_dcdc.h
)

mcux_add_include(
    INCLUDES dcdc
)

mcux_add_source(
    SOURCES low_power/board_lp.c
            low_power/board_lp.h
)

mcux_add_include(
    INCLUDES low_power
)
mcux_add_macro(HAL_UART_ADAPTER_LOWPOWER=1)


mcux_add_source(
    SOURCES app_common/app_services_init.c
)

mcux_add_source(
    SOURCES app_common/app.h
            app_common/app_ble_init.c
)

mcux_add_source(
    SOURCES app_common/hardware_init.c
)

mcux_add_include(
    INCLUDES app_common
)
mcux_set_variable(gcc_wireless_linker_file connectivity.ld)

mcux_set_variable(gcc_wireless_linker_file_ble connectivity_ble.ld)

mcux_set_variable(iar_wireless_linker_file connectivity.icf)

mcux_remove_armgcc_linker_script(
    BASE_PATH ${SdkRootDirPath}
    TARGETS debug release
    LINKER ${device_root}/${soc_portfolio}/${soc_series}/${device}/gcc/${CONFIG_MCUX_TOOLCHAIN_LINKER_DEVICE_PREFIX}_flash.ld
)


mcux_add_armgcc_linker_script(
    LINKER ../linker_files/connectivity_ble.ld
    PREPROCESSED TRUE
    TARGETS debug release
    PARAMETERS -DMCXW716C_SERIES
    INCLUDES ${SdkRootDirPath}/examples/_common/project_segments/wireless/mcxw71
)
mcux_remove_iar_linker_script(
    BASE_PATH ${SdkRootDirPath}
    TARGETS debug release
    LINKER ${device_root}/${soc_portfolio}/${soc_series}/${device}/iar/${CONFIG_MCUX_TOOLCHAIN_LINKER_DEVICE_PREFIX}_flash.icf
)


mcux_add_iar_linker_script(
    LINKER ../linker_files/connectivity.icf
    PREPROCESSED TRUE
    TARGETS debug release
    PARAMETERS -DMCXW716C_SERIES
    INCLUDES ${SdkRootDirPath}/examples/_common/project_segments/wireless/mcxw71
)
mcux_add_cmakelists(${SdkRootDirPath}/middleware/wireless/bluetooth/application/common OPTIONAL)

mcux_add_configuration(
    CC "-DSDK_DEBUGCONSOLE=1"
    CX "-DSDK_DEBUGCONSOLE=1"
)


mcux_add_source(
    SOURCES wireless_examples/pin_mux.c
            wireless_examples/pin_mux.h
)

mcux_add_include(
    INCLUDES wireless_examples
)
