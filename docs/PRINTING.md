# Hub printing

Printer settings and structured `PrintJob` records use the app model. The hub
renders raw printer output with `src/shared/escpos.ts`, queues jobs durably, runs
one job at a time per printer in creation order, retries failures with capped
exponential backoff, and tries a configured fallback printer once before
retrying/failing. Queue state and errors are broadcast to same-store WebSocket
clients. The app is not yet connected to this queue, so app-side failed-job
reporting is not yet surfaced in its UI.

Supported hub connections:

- Raw TCP ESC/POS on port 9100 (configurable).
- Windows raw spooler jobs, Linux CUPS `lp -o raw`, or a Linux `/dev/usb/lp*`
  path.
- Serial COM ports on Windows and `/dev/tty*` devices on Linux.
- Separate Epson ePOS-Print XML and Star WebPRNT XML transports.
- Star CloudPRNT polling at `/api/cloudprnt/:storeId/:printerId` using the
  configured `HUB_CLOUDPRNT_TOKEN`; POST the `jobId` and `success` result to
  that path after printing.
- Development virtual TCP printer on `127.0.0.1:9101` by default. It records
  received bytes in `hub/data/virtual-printer/`; preview them at
  `/api/virtual/preview`. Override the mock port with
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
