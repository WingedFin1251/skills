# USB Peripheral Reference (STM32F3)

## Features (from F3 training)

| Feature | Description |
|---------|-------------|
| Standard | USB 2.0 Full Speed (12 Mbit/s), Low Speed (1.5 Mbit/s) |
| Type | USB Device only (no OTG on F3) |
| Speed detection | Pull-up on D+ = Full Speed, Pull-up on D− = Low Speed |
| Endpoints | Programmable, control + bulk/interrupt/isochronous |
| Power | Self-powered or bus-powered (100mA low / 500mA high-power) |
| Suspend | <2.5 mA from VBUS when bus idle >3 ms |
| SOF | Full Speed: every 1 ms; Low Speed: keep-alive EOP every 1 ms |

## USB Transaction

```
Host → Device: Token packet (SETUP / IN / OUT)
Device → Host: Data packet (DATA0 / DATA1)
Host → Device: Handshake (ACK / NAK / STALL)
```

## Common USB Issues

| Symptom | Likely Cause |
|---------|-------------|
| Device not detected | Missing/misconnected 1.5kΩ pull-up on D+ |
| Enumeration fails | Wrong descriptor (device/config/string) or address conflict |
| Suspend/resume broken | No remote wakeup configured, or SOF lost |
| Data transfer corrupted | Buffer alignment, endpoint size mismatch, or toggle bit sync lost |
| Power issue | Bus-powered device exceeding 100mA before configuration |

## HAL Init Sequence

```
1. __HAL_RCC_USB_CLK_ENABLE()
2. HAL_PCD_Init()           — Init USB device core
3. HAL_PCD_Start()          — Start USB device
4. HAL_PCD_DevConnect()     — Connect pull-up on D+
```
