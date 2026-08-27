# CAN Peripheral Reference (bxCAN)

## Features (from F3 training)

| Feature | Description |
|---------|-------------|
| Standard | CAN 2.0 A & B Active |
| Bit rate | Up to 1 Mbit/s |
| Tx mailboxes | 3, with configurable priority |
| Rx FIFOs | 2, each with 3 stages |
| Filter banks | 14 scalable (32-bit or 16-bit) |
| Dedicated RAM | 512 bytes (no longer shared with USB on F3) |
| Interrupt vectors | 4: Tx, FIFO0, FIFO1, Status/Error |

## Operating Modes

```
Normal Mode       — Standard Tx/Rx on bus
Sleep Mode        — Low power, wake on CAN message
Initialization    — Configure bit timing, filters, masks
  ↓
Test Mode:
  ├─ Silent          — Receive only, no ACK (listen-only)
  ├─ LoopBack        — Tx looped to Rx internally, no bus xmit
  └─ LoopBack+Silent — Combined internal loop + listen-only
```

## Bit Timing Formula

```
Tbit = (SYNC_SEG + TSEG1 + TSEG2) × TPCLK
Baud = 1 / Tbit

Where SYNC_SEG = 1 Tq (fixed)
      TSEG1 = BS1[3:0] + 1       — Propagation + Phase 1
      TSEG2 = BS2[2:0] + 1       — Phase 2
      SJW = JW[1:0] + 1          — Resynchronization jump width
```

## Common CAN Issues

| Symptom | Likely Cause |
|---------|-------------|
| Bus off | Dominant bit error, wrong baud rate, or missing termination |
| No ACK | Only one node on bus without loop-back mode |
| Messages lost | Filter masks misconfigured, or FIFO overrun |
| Error passive | High error count — check bus wiring and termination |
| TX priority wrong | Mailbox priority set to lowest when multiple pending |

## HAL Init Sequence

```
1. __HAL_RCC_CAN1_CLK_ENABLE()
2. HAL_CAN_Init()              — Bit timing, mode
3. HAL_CAN_ConfigFilter()      — Acceptance filter banks
4. HAL_CAN_Start()             — Start CAN communication
5. HAL_CAN_ActivateNotification() — Enable interrupts
```
