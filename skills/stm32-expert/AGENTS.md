# STM32 Expert Guidelines

**A comprehensive guide for AI agents reviewing STM32 firmware code**, organized by priority and impact.

---

## Table of Contents

### Series Detection — **MANDATORY**
0. [STM32 Series Identification](#0-stm32-series-identification)

### Correctness — **CRITICAL**
1. [Clock & System Configuration](#1-clock--system-configuration)
2. [Peripheral Initialization](#2-peripheral-initialization)

### Resource & Concurrency — **HIGH**
3. [Interrupt & NVIC Configuration](#3-interrupt--nvic-configuration)
4. [DMA Configuration](#4-dma-configuration)
5. [FreeRTOS Synchronization](#5-freertos-synchronization)
6. [Pin Conflicts & Alternate Functions](#6-pin-conflicts--alternate-functions)

### Style & Optimization — **MEDIUM**
7. [Low-Power Modes](#7-low-power-modes)
8. [Code Style & Project Structure](#8-code-style--project-structure)

---

## 0. STM32 Series Identification

**Impact: MANDATORY | Category: meta | Tags:** stm32-series, chip-detection

Identify the STM32 series by examining HAL header includes and startup files:

| Heuristic | F1/F4 | G0/G4 | H7 |
|-----------|-------|-------|-----|
| Core | Cortex-M3/M4 | Cortex-M0+/M4 | Cortex-M7 |
| HAL header | `stm32f1xx_hal.h` | `stm32g0xx_hal.h` | `stm32h7xx_hal.h` |
| Max Freq | 72/168 MHz | 64/170 MHz | 480 MHz |
| FPU | Single (F4) | Optional (G4) | Double precision |

**F1/F4:** Watch for SPL+HAL mixing. F1 has no FPU, F4 has single-precision.
**G0/G4:** Check low-power peripherals (LPUART, LPTIM). G0 has no FPU.
**H7:** Cache coherency is critical. Check MPU/SCB configuration.

---

## 1. Clock & System Configuration

**Impact: CRITICAL | Category: clock-system | Tags:** pll, rcc, hse, hsi, flash-ws

### Why This Matters
Incorrect clock configuration is the #1 cause of STM32 system hangs. An
overclocked SYSCLK, mismatched Flash wait states, or wrong PLL parameters
can cause silent data corruption or complete boot failure.

### 1.1 Enable Peripheral Clock Before Initialization

#### ❌ Incorrect

```c
// BUG: USART1 clock never enabled
UART_HandleTypeDef huart1;
huart1.Instance = USART1;
HAL_UART_Init(&huart1);  // Will fail — peripheral clock not running
```

#### ✅ Correct

```c
__HAL_RCC_USART1_CLK_ENABLE();  // Enable peripheral clock first

huart1.Instance = USART1;
huart1.Init.BaudRate = 115200;
huart1.Init.WordLength = UART_WORDLENGTH_8B;
huart1.Init.StopBits = UART_STOPBITS_1;
huart1.Init.Parity = UART_PARITY_NONE;
huart1.Init.Mode = UART_MODE_TX_RX;
HAL_UART_Init(&huart1);
```

### 1.2 Validate PLL Parameters Against Maximums

#### ❌ Incorrect

```c
// STM32F446: HSE=8MHz, PLLM=8, PLLN=450, PLLP=2
// VCO = 8/8*450 = 450MHz — exceeds F446 VCO max of 432MHz!
RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
RCC_OscInitStruct.PLL.PLLM = 8;
RCC_OscInitStruct.PLL.PLLN = 450;  // VCO out of range!
RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV2;
```

#### ✅ Correct

```c
// F446 VCO range: 100-360MHz. HSE=8MHz, PLLM=4, PLLN=168, PLLP=2
// VCO = 8/4*168 = 336MHz ✅  SYSCLK = 336/2 = 168MHz ✅
RCC_OscInitStruct.PLL.PLLM = 4;
RCC_OscInitStruct.PLL.PLLN = 168;
RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV2;
```

### 1.3 Match Flash Wait States to HCLK Frequency

#### ❌ Incorrect

```c
// STM32F4 @ 168MHz with only 3 wait states — needs 5 WS for >150MHz
__HAL_FLASH_SET_LATENCY(FLASH_LATENCY_3);
// Data corruption risk!
```

#### ✅ Correct

```c
// STM32F4 Vcc=3.3V: 0WS ≤30MHz, 1WS ≤60MHz, 2WS ≤90MHz,
// 3WS ≤120MHz, 4WS ≤150MHz, 5WS ≤168MHz
__HAL_FLASH_SET_LATENCY(FLASH_LATENCY_5);  // 168MHz needs 5 WS
```

---

## 2. Peripheral Initialization

**Impact: CRITICAL | Category: peripheral-init | Tags:** gpio, uart, spi, i2c, adc, af

### 2.1 Configure GPIO Mode and Alternate Function Correctly

#### ❌ Incorrect

```c
// USART1 TX=PA9, RX=PA10 — but AF not set!
GPIO_InitStruct.Pin = GPIO_PIN_9 | GPIO_PIN_10;
GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
// Missing GPIO_InitStruct.Alternate = GPIO_AF7_USART1;
// UART will not transmit/receive
```

#### ✅ Correct

```c
GPIO_InitStruct.Pin = GPIO_PIN_9 | GPIO_PIN_10;
GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
GPIO_InitStruct.Alternate = GPIO_AF7_USART1;  // Critical!
HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
```

### 2.2 Verify UART Baud Rate

```c
// Baud = UART_Clock / (16 * USARTDIV)
// F4: USART1 clocked by APB2=84MHz, target 115200
// USARTDIV = 84,000,000 / (16 * 115200) = 45.5729...
// Fractional part: 0.5729 × 16 = 9.17 → 9 → error ≈ 0.1% ✅
```

---

## 3. Interrupt & NVIC Configuration

**Impact: HIGH | Category: interrupt-nvic | Tags:** nvic, irq, priority, critical-section

### 3.1 Set NVIC Priority Grouping Before Configuring Interrupts

#### ❌ Incorrect

```c
HAL_NVIC_SetPriority(USART1_IRQn, 1, 0);  // Priority grouping not set!
// Default grouping may cause unexpected preemption behavior
```

#### ✅ Correct

```c
// Set at the very beginning of main()
HAL_NVIC_SetPriorityGrouping(NVIC_PRIORITYGROUP_2);  // 2 preempt + 2 sub
// Now 4 levels of preemption, 4 sub-priorities per level
HAL_NVIC_SetPriority(USART1_IRQn, 1, 0);
HAL_NVIC_EnableIRQ(USART1_IRQn);
```

### 3.2 Keep ISR Functions Short

#### ❌ Incorrect

```c
void USART1_IRQHandler(void) {
    HAL_UART_IRQHandler(&huart1);
    // 50+ lines of processing here... blocks other interrupts!
    if (rx_buffer_full) { process_command(); }
    if (timeout) { reset_connection(); }
    update_display();  // Don't do this in ISR!
}
```

#### ✅ Correct

```c
void USART1_IRQHandler(void) {
    HAL_UART_IRQHandler(&huart1);
}

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    // Set flag, process in main loop
    data_ready = 1;
}
```

---

## 4. DMA Configuration

**Impact: HIGH | Category: dma | Tags:** dma, stream, channel, circular

### 4.1 Match DMA Direction and Data Width

#### ❌ Incorrect

```c
hdma_tim.Instance = DMA2_Stream1;
hdma_tim.Init.Channel = DMA_CHANNEL_6;
hdma_tim.Init.Direction = DMA_MEMORY_TO_PERIPH;
hdma_tim.Init.PeriphDataAlignment = DMA_PDATAALIGN_HALFWORD;  // 16-bit
hdma_tim.Init.MemDataAlignment = DMA_MDATAALIGN_WORD;  // 32-bit mismatch!
```

#### ✅ Correct

```c
hdma_tim.Init.PeriphDataAlignment = DMA_PDATAALIGN_HALFWORD;
hdma_tim.Init.MemDataAlignment = DMA_MDATAALIGN_HALFWORD;  // Must match
```

---

## 5. FreeRTOS Synchronization

**Impact: HIGH | Category: freertos | Tags:** tasks, queues, semaphores, isr

### 5.1 Use FromISR API in Interrupt Context

#### ❌ Incorrect

```c
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    xQueueSend(data_queue, &rx_byte, 0);  // BUG: called from ISR!
    //可能导致临界区崩溃
}
```

#### ✅ Correct

```c
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    xQueueSendFromISR(data_queue, &rx_byte, &xHigherPriorityTaskWoken);
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}
```

### 5.2 Prefer Mutex Over Binary Semaphore for Shared Resources

```c
// ✅ Mutex — has priority inheritance, prevents inversion
static SemaphoreHandle_t uart_mutex;
uart_mutex = xSemaphoreCreateMutex();

// ❌ Binary semaphore — no priority inheritance
uart_sem = xSemaphoreCreateBinary();
```

---

## 6. Pin Conflicts & Alternate Functions

**Impact: HIGH | Category: pin-conflict | Tags:** gpio-af, swd, remap

### 6.1 Verify AF Number Matches Target Peripheral

#### ❌ Incorrect

```c
// SPI1 on PA5 (SCK) needs AF5 on STM32F4
GPIO_InitStruct.Alternate = GPIO_AF6_SPI1;  // BUG: AF6 is SPI2 on F4!
```

#### ✅ Correct

```c
// STM32F407: SPI1_SCK=PA5 → AF5
GPIO_InitStruct.Alternate = GPIO_AF5_SPI1;  // Correct for F4 series
```

### 6.2 Don't Occupy SWD Debug Pins

```c
// PA13=SWDIO, PA14=SWCLK — do NOT configure as GPIO output
// If they must be reused, disable debug in DBGMCU first:
__HAL_AFIO_REMAP_SWJ_DISABLE();  // F1
// Or in H7:
HAL_DBGMCU_DisableDBGSleepMode();
```

---

## 7. Low-Power Modes

**Impact: MEDIUM | Category: low-power | Tags:** sleep, stop, standby, wake

### 7.1 Configure Wake-Up Source Before Entering Stop Mode

#### ❌ Incorrect

```c
HAL_PWR_EnterSTOPMode(PWR_LOWPOWERREGULATOR_ON, PWR_STOPENTRY_WFI);
// No wake-up source configured! Device may never wake up.
```

#### ✅ Correct

```c
// 1. Configure EXTI line as wake-up
HAL_GPIO_WritePin(GPIOA, GPIO_PIN_0, GPIO_PIN_RESET);
// 2. Enter stop mode with regulator in low-power
HAL_PWR_EnterSTOPMode(PWR_LOWPOWERREGULATOR_ON, PWR_STOPENTRY_WFI);
// 3. On wake: reconfigure system clock!
SystemClock_Config();
```

### 7.2 Reconfigure Clock After Stop Mode Exit

```c
// Stop mode disables HSI/HSE — clock must be restored
void HAL_PWR_ExitSTOPMode(void) {
    SystemClock_Config();  // MUST call after wake
}
```

---

## 8. Code Style & Project Structure

**Impact: MEDIUM | Category: style | Tags:** cubemx, error-handler, project-structure

### 8.1 Implement Error_Handler Properly

#### ❌ Incorrect

```c
void Error_Handler(void) {
    while(1);  // Silent hang — no debug information
}
```

#### ✅ Correct

```c
void Error_Handler(void) {
    // Toggle error LED
    HAL_GPIO_WritePin(ERROR_LED_PORT, ERROR_LED_PIN, GPIO_PIN_SET);
    // Print debug info (if UART available)
    char *msg = "FATAL: System error";
    HAL_UART_Transmit(&huart1, (uint8_t*)msg, strlen(msg), 100);
    // Disable interrupts and halt
    __disable_irq();
    while(1);
}
```

### 8.2 Use HAL_Delay Instead of Busy Loops

#### ❌ Incorrect

```c
for (volatile int i = 0; i < 1000000; i++);  // Unpredictable delay
```

#### ✅ Correct

```c
HAL_Delay(100);  // Millisecond-accurate, based on SysTick
```

---

## Code Review Report Format

```markdown
## Summary
[Overall assessment]

## Critical Issues 🔴
### N. [Issue]
**File:** `main.c:42`
**Issue:** [Description]
**Fix:** ```c ... ```

## High Priority 🟠
...

## Medium Priority 🟡
...

## Tool Results
### .ioc Config Check
```
[check-ioc-config.sh output]
```

## Issue Count
- 🔴 CRITICAL: N
- 🟠 HIGH: N
- 🟡 MEDIUM: N

**Recommendation:** [Next steps]
```

## Quick Reference

### Priority Matrix

| Level | Description | Examples | Action |
|-------|-------------|----------|--------|
| **CRITICAL** | Clock failure, peripheral dead | Wrong PLL, missing RCC clock | Fix immediately |
| **HIGH** | Deadlock, data loss, race | Wrong IRQ priority, DMA mismatch | Fix before merge |
| **MEDIUM** | Power waste, style | Missing low-power init, bad Error_Handler | Fix or accept |

### References

- [STM32Cube HAL Documentation](https://www.st.com/en/embedded-software/stm32cube-mcu-packages.html)
- [STM32 Reference Manuals](https://www.st.com/en/microcontrollers-microprocessors/stm32f4-series.html#documentation)
- [FreeRTOS Coding Standard](https://www.freertos.org/FreeRTOS-coding-standard.html)
- [AN4539 HRTIM Guide](https://www.st.com/resource/en/application_note/an4539-hrtim-guide-stmicroelectronics.pdf)
- [USB 2.0 Specification](https://www.usb.org/document-library/usb-20-specification)
