# Clock Configuration Reference

## PLL Formula

```
VCO = (HSE / PLLM) × PLLN
SYSCLK = VCO / PLLP
USB/SDIO = VCO / PLLQ
```

## Maximum Frequencies by Series

| Series | SYSCLK Max | AHB Max | APB1 Max | APB2 Max | VCO Max |
|--------|-----------|---------|----------|----------|---------|
| STM32F103 | 72 MHz | 72 MHz | 36 MHz | 72 MHz | N/A |
| STM32F407 | 168 MHz | 168 MHz | 42 MHz | 84 MHz | 432 MHz |
| STM32F429 | 180 MHz | 180 MHz | 45 MHz | 90 MHz | 432 MHz |
| STM32G030 | 64 MHz | 64 MHz | 64 MHz | 64 MHz | 344 MHz |
| STM32G474 | 170 MHz | 170 MHz | 170 MHz | 170 MHz | 344 MHz |
| STM32H743 | 480 MHz | 240 MHz | 120 MHz | 120 MHz | 800 MHz |

## Flash Wait States (STM32F4 @ 3.3V)

| HCLK (MHz) | Wait States |
|-----------|-------------|
| ≤ 30 | 0 |
| ≤ 60 | 1 |
| ≤ 90 | 2 |
| ≤ 120 | 3 |
| ≤ 150 | 4 |
| ≤ 168 | 5 |

## RCC Init Sequence (Required Order)

1. `HAL_RCC_DeInit()` — Reset RCC to default state
2. `RCC_OscInit()` — Configure HSI/HSE, PLL sources and multipliers
3. `RCC_ClkInit()` — Configure AHB/APB1/APB2 prescalers, select SYSCLK source
4. `HAL_RCC_GetHCLKFreq()` — Verify HCLK against Flash wait states
5. `__HAL_FLASH_SET_LATENCY()` — Must be called BEFORE switching SYSCLK to PLL

## Common Clock Errors

| Symptom | Likely Cause |
|---------|-------------|
| System won't start | PLL VCO out of range, or HSE not ready |
| UART baud wrong | APB clock misconfigured, wrong PLLQ |
| I2C timing off | I2C clock source incorrect |
| USB not working | PLLQ not configured or 48MHz mismatch |
| Timers running slow | APB timer multiplier (x2) not accounted for |
