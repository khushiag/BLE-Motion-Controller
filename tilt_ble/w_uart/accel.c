/* accel.c - reads the on-board FXLS8964 accelerometer over I2C (LPI2C1) */
#include <string.h>
#include <math.h>
#include "fsl_common.h"
#include "fsl_port.h"
#include "fsl_lpi2c.h"
#include "accel.h"

/* ---------- Settings ---------- */
#define ACCEL_I2C             LPI2C1
#define ACCEL_I2C_BAUDRATE    100000U

/* Sensor register addresses (same as tilt_reader) */
#define ACCEL_REG_OUT_X_LSB   0x04U
#define ACCEL_REG_WHOAMI      0x13U
#define ACCEL_REG_SENS_CFG1   0x15U
#define ACCEL_REG_SENS_CFG3   0x17U
#define ACCEL_ACTIVE_MASK     0x01U
#define ACCEL_WAKE_ODR_100HZ  0x50U

static uint8_t s_addr = 0U;   /* I2C address of the sensor once found */

/* ---------- Low-level helpers ---------- */
static bool Accel_ReadRegs(uint8_t reg, uint8_t *buf, size_t len)
{
    lpi2c_master_transfer_t xfer;
    memset(&xfer, 0, sizeof(xfer));
    xfer.slaveAddress   = s_addr;
    xfer.direction      = kLPI2C_Read;
    xfer.subaddress     = reg;
    xfer.subaddressSize = 1;
    xfer.data           = buf;
    xfer.dataSize       = len;
    xfer.flags          = kLPI2C_TransferDefaultFlag;
    return (LPI2C_MasterTransferBlocking(ACCEL_I2C, &xfer) == kStatus_Success);
}

static bool Accel_WriteReg(uint8_t reg, uint8_t value)
{
    lpi2c_master_transfer_t xfer;
    memset(&xfer, 0, sizeof(xfer));
    xfer.slaveAddress   = s_addr;
    xfer.direction      = kLPI2C_Write;
    xfer.subaddress     = reg;
    xfer.subaddressSize = 1;
    xfer.data           = &value;
    xfer.dataSize       = 1;
    xfer.flags          = kLPI2C_TransferDefaultFlag;
    return (LPI2C_MasterTransferBlocking(ACCEL_I2C, &xfer) == kStatus_Success);
}

static void Accel_InitPinsAndClock(void)
{
    /* Clock for the I2C peripheral (from tilt_reader's hardware_init.c) */
    CLOCK_SetIpSrc(kCLOCK_Lpi2c1, kCLOCK_IpSrcFro192M);
    CLOCK_SetIpSrcDiv(kCLOCK_Lpi2c1, kSCG_SysClkDivBy16);

    /* Pin setup (from tilt_reader's pin_mux.c) */
    CLOCK_EnableClock(kCLOCK_PortB);

    const port_pin_config_t portb4_pin2_config = {
        (uint16_t)kPORT_PullUp,               /* internal pull-up enabled  */
        (uint16_t)kPORT_LowPullResistor,
        (uint16_t)kPORT_FastSlewRate,
        (uint16_t)kPORT_PassiveFilterDisable,
        (uint16_t)kPORT_OpenDrainDisable,
        (uint16_t)kPORT_LowDriveStrength,
        (uint16_t)kPORT_NormalDriveStrength,
        (uint16_t)kPORT_MuxAlt4,              /* PTB4 = LPI2C1_SDA */
        (uint16_t)kPORT_UnlockRegister};
    PORT_SetPinConfig(PORTB, 4U, &portb4_pin2_config);

    const port_pin_config_t portb5_pin3_config = {
        (uint16_t)kPORT_PullUp,               /* internal pull-up enabled  */
        (uint16_t)kPORT_LowPullResistor,
        (uint16_t)kPORT_FastSlewRate,
        (uint16_t)kPORT_PassiveFilterDisable,
        (uint16_t)kPORT_OpenDrainDisable,
        (uint16_t)kPORT_LowDriveStrength,
        (uint16_t)kPORT_NormalDriveStrength,
        (uint16_t)kPORT_MuxAlt4,              /* PTB5 = LPI2C1_SCL */
        (uint16_t)kPORT_UnlockRegister};
    PORT_SetPinConfig(PORTB, 5U, &portb5_pin3_config);
}

/* ---------- Public functions ---------- */
bool Accel_Init(void)
{
    static const uint8_t candidates[] = {0x18U, 0x19U};
    lpi2c_master_config_t masterCfg;
    uint8_t who  = 0U;
    uint8_t cfg1 = 0U;
    uint32_t i;

    Accel_InitPinsAndClock();

    LPI2C_MasterGetDefaultConfig(&masterCfg);
    masterCfg.baudRate_Hz = ACCEL_I2C_BAUDRATE;
    LPI2C_MasterInit(ACCEL_I2C, &masterCfg, CLOCK_GetIpFreq(kCLOCK_Lpi2c1));

    /* Find the sensor: try each possible address and ask for its ID */
    s_addr = 0U;
    for (i = 0U; i < sizeof(candidates); i++)
    {
        s_addr = candidates[i];
        if (Accel_ReadRegs(ACCEL_REG_WHOAMI, &who, 1U))
        {
            break;
        }
        s_addr = 0U;
    }
    if (s_addr == 0U)
    {
        return false;   /* nothing answered */
    }

    /* Standby -> set 100 Hz measurement rate -> Active */
    if (!Accel_ReadRegs(ACCEL_REG_SENS_CFG1, &cfg1, 1U))
    {
        return false;
    }
    cfg1 &= (uint8_t)~ACCEL_ACTIVE_MASK;
    if (!Accel_WriteReg(ACCEL_REG_SENS_CFG1, cfg1))
    {
        return false;
    }
    if (!Accel_WriteReg(ACCEL_REG_SENS_CFG3, ACCEL_WAKE_ODR_100HZ))
    {
        return false;
    }
    if (!Accel_WriteReg(ACCEL_REG_SENS_CFG1, (uint8_t)(cfg1 | ACCEL_ACTIVE_MASK)))
    {
        return false;
    }

    return true;
}

bool Accel_ReadTilt(float *pRoll, float *pPitch)
{
    uint8_t b[6];

    if ((s_addr == 0U) || !Accel_ReadRegs(ACCEL_REG_OUT_X_LSB, b, 6U))
    {
        return false;
    }

    int16_t x = (int16_t)((b[1] << 8U) | b[0]);
    int16_t y = (int16_t)((b[3] << 8U) | b[2]);
    int16_t z = (int16_t)((b[5] << 8U) | b[4]);

    float fx = (float)x;
    float fy = (float)y;
    float fz = (float)z;

    *pRoll  = atan2f(fy, fz) * 57.2958f;
    *pPitch = atan2f(-fx, sqrtf(fy * fy + fz * fz)) * 57.2958f;
    return true;
}