# FreeRTOS Integration Reference

## Task Stack Size Estimation

| Complex | Stack Size | Example |
|---------|-----------|---------|
| Minimal | 128 words | Blinky LED |
| Light | 256 words | UART polling |
| Medium | 512 words | Command parser |
| Heavy | 1024+ words | FatFS + USB |

Formula: `StackBytes / 4` (STM32 is 32-bit, 1 word = 4 bytes)

## ISR-Safe API Functions

| Normal API | ISR-Safe API | Notes |
|-----------|-------------|-------|
| `xQueueSend()` | `xQueueSendFromISR()` | Returns pdTRUE if task woken |
| `xQueueReceive()` | `xQueueReceiveFromISR()` | |
| `xSemaphoreGive()` | `xSemaphoreGiveFromISR()` | |
| `xSemaphoreTake()` | `xSemaphoreTakeFromISR()` | |
| `vTaskDelay()` | ❌ N/A | Use in tasks only |
| `vTaskDelayUntil()` | ❌ N/A | Use in tasks only |

## FreeRTOSConfig.h Common Settings

| Setting | STM32F4 Typical | Notes |
|---------|----------------|-------|
| configCPU_CLOCK_HZ | 168000000 | Match SYSCLK |
| configTICK_RATE_HZ | 1000 | 1ms tick |
| configMAX_PRIORITIES | 5 | Prioritize carefully |
| configMINIMAL_STACK_SIZE | 128 | Words, not bytes |
| configTOTAL_HEAP_SIZE | 32768 | 32KB heap |
| configUSE_MUTEXES | 1 | Enable priority inheritance |
| configUSE_COUNTING_SEMAPHORES | 1 | Resource counting |

## Priority Inversion Prevention

```c
// ❌ Binary semaphore — no priority inheritance
xSemaphoreCreateBinary();

// ✅ Mutex — has priority inheritance
xSemaphoreCreateMutex();
```

## vTaskDelayUntil Pattern

```c
// Periodic task with fixed frequency
TickType_t xLastWakeTime = xTaskGetTickCount();
const TickType_t xFrequency = pdMS_TO_TICKS(100);  // 100ms

for (;;) {
    vTaskDelayUntil(&xLastWakeTime, xFrequency);
    // Executed every 100ms regardless of processing time
    HAL_GPIO_TogglePin(LED_PORT, LED_PIN);
}
```
