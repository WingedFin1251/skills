# HRTIM Reference (High-Resolution Timer)

## Overview (from AN4539)

HRTIM is a high-resolution timer available on STM32F334xx (and select G4 parts). It provides up to **10 PWM outputs** with **217 ps resolution** (at 144 MHz with HSE PLL).

## Key Specifications

| Parameter | HSE (crystal) | HSI (internal) |
|-----------|--------------|----------------|
| HRTIM clock | 144 MHz (PLL × 18) | 128 MHz (PLL × 16) |
| Resolution | 217 ps | 244 ps |
| CPU clock | 72 MHz (PLL/2) | 64 MHz (PLL/2) |
| DLL calibration | Required, ~14 µs periodic | Same |

## Architecture

```
6 timer units (A, B, C, D, E, Master)
├─ Each: 16-bit auto-reload up-counter
├─ Each: 4 compare registers
├─ Each: Set/Reset crossbar for 2 outputs
└─ Master: sync, burst mode, external event

Output stage:
├─ Dead-time insertion
├─ Polarity control
├─ Idle/run states
└─ Fault protection (FAULT inputs)
```

## DLL Calibration (Required Before Use)

```c
__HAL_RCC_HRTIM1_CONFIG(RCC_HRTIM1CLK_PLLCLK);  // Select PLL as HRTIM clock
__HRTIM1_CLK_ENABLE();                           // Enable HRTIM clock

// Calibrate DLL with periodic calibration at 14 µs
HRTIM1->sCommonRegs.DLLCR = HRTIM_CALIBRATIONRATE_14 | HRTIM_DLLCR_CALEN;
while (HRTIM1->sCommonRegs.ISR & HRTIM_IT_DLLRDY == RESET);
```

## Period Calculation

```
PER = T_desired / T_resolution
Example: 10 µs / 217 ps = 46082 → 0x0000B400
```

## HRTIM I/O Mapping

| Port | AF | Usage |
|------|----|-------|
| Port A, B | AF13 | HRTIM outputs/inputs |
| Port C | AF3 | HRTIM outputs/inputs |

## Interrupt Vectors

7 interrupt vectors for HRTIM, grouped as:
- **Master timer** events
- **Timer A, B, C, D, E** events
- **Fault/Error** events (highest recommended priority)

## Common HRTIM Issues

| Issue | Likely Cause |
|-------|-------------|
| Outputs not toggling | Outputs initialized before HRTIM control registers set (see AN4539 §1.4.4) |
| Wrong PWM frequency | PER register miscalculation or wrong HRTIM clock source |
| No high resolution | DLL not calibrated, or HSE not stable |
| Fault triggered | FAULT input polarity mismatch, or protection event |
| Dead time wrong | Dead-time registers not set, or output polarity inverted |

## HAL Init Sequence

```
1. __HAL_RCC_HRTIM1_CONFIG(RCC_HRTIM1CLK_PLLCLK)  — HRTIM clock source
2. __HRTIM1_CLK_ENABLE()                           — Enable APB clock
3. HRTIM_DLL_Calibration()                         — DLL calibration
4. GPIO_HRTIM_outputs_Config()                     — Set AF13/AF3 on pins
5. HAL_HRTIM_Init()                                — Configure timer units
6. HAL_HRTIM_WaveformOutputStart()                 — Start PWM outputs
```
