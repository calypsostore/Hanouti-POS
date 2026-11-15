# Hub printing

Printer settings and structured `PrintJob` records use the app model. The hub
renders raw printer output with `src/shared/escpos.ts`, queues jobs durably, runs
one job at a time per printer in creation order, retries failures with capped
exponential backoff, and tries a configured fallback printer once before
retrying/failing. Queue state and errors are broadcast to same-store WebSocket
clients. HubProvider sends app jobs to this queue and surfaces failures in the
TopBar; standalone mode keeps its local queue. Physical output still needs
hardware verification.

## Support and verification matrix

| Connection type | Implemented path | Verification | Notes |
| --- | --- | --- | --- |
| Virtual TCP ESC/POS (`127.0.0.1:9101`) | Hub TCP queue | **Simulator-tested** | Raw bytes are captured in the hub data directory; this does not verify physical output. |
| Ethernet/Wi-Fi ESC/POS, raw TCP (usually port 9100) | Hub TCP queue | **Untested on hardware** | Recommended first hardware trial: any 58/80 mm ESC/POS printer with documented raw TCP port 9100 support. |
| Windows spooler / Linux CUPS / `/dev/usb/lp*` | OS printer driver | **Untested on hardware** | Depends on the host's installed printer driver and raw mode support. |
| Serial COM / `/dev/tty*` | Hub serial driver | **Untested on hardware** | Baud rate and device permissions must match the printer. |
| Epson ePOS-Print XML | Epson network endpoint | **Untested on hardware** | Requires a compatible enabled Epson ePOS-Print service and endpoint. |
| Star WebPRNT XML | Star network endpoint | **Untested on hardware** | Requires a compatible Star WebPRNT service and firmware. |
| Star CloudPRNT | Authenticated hub polling endpoint | **Untested on hardware** | Requires a CloudPRNT-capable device and a separately configured token. |
| Browser print / WebSerial | Browser/device-local | **Code-path tested; untested on hardware** | Browser print only confirms the dialog opened; WebSerial depends on browser permissions and device support. |
| Bluetooth printer | Not a generic protocol | **Not supported** | Printer-specific GATT protocols are not configured. |

No physical printer or drawer has been verified. In this matrix, an implemented
transport path does not imply every model, firmware, cut command, drawer pulse,
or paper result has been tested. Check the hardware integration before relying
on live service.

## Hub connection types

- Raw TCP ESC/POS on port 9100 (configurable).
- Windows raw spooler jobs, Linux CUPS `lp -o raw`, or a Linux `/dev/usb/lp*`
  path.
- Serial COM ports on Windows and `/dev/tty*` devices on Linux.
- Separate Epson ePOS-Print XML and Star WebPRNT XML transports.
- Star CloudPRNT polling at `/api/cloudprnt/:storeId/:printerId` using the
  configured `HUB_CLOUDPRNT_TOKEN`; POST the `jobId` and `success` result to
  that path after printing.
- Development virtual TCP printer on `127.0.0.1:9101` by default. It records
  received bytes in `hub/data/virtual-printer/`. Override the mock port with
  `HUB_VIRTUAL_PRINTER_PORT`.

Use `/api/print/test` to enqueue a test print. `/api/printers/discover` scans
non-loopback local IPv4 /24 subnets for port 9100. This can take several seconds
on large or filtered LANs. It sends a TCP connection probe only; it does not
identify models or configure discovered devices. `npm run hub -- doctor` checks
the hub configuration and lists configured printers.

Actual device communication, raw spooler behavior, protocol compatibility,
cutter, drawer pulse, serial settings, and physical print quality are **untested
on hardware**. Configure printers only on a trusted shop LAN. Test Epson/Star
models and firmware before relying on them for orders.

For the first physical trial, use a 58/80 mm Ethernet or Wi-Fi ESC/POS printer
that documents raw TCP printing on port 9100. Run the test-print action, check
that one job appears in the queue, then inspect the physical output before
enabling automatic tickets, retries, or drawer kick. Retry/fallback integration
is covered with the virtual printer, not a disconnected physical printer.
