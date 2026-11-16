import Capacitor
import Foundation
import Network

@objc(TcpPrinterPlugin)
public class TcpPrinterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TcpPrinterPlugin"
    public let jsName = "TcpPrinter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise)
    ]

    @objc func send(_ call: CAPPluginCall) {
        guard let host = call.getString("host")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !host.isEmpty else {
            resolve(call, ok: false, error: "Printer host is required.")
            return
        }
        let portValue = call.getInt("port") ?? 9100
        guard (1...65535).contains(portValue),
              let port = NWEndpoint.Port(rawValue: UInt16(portValue)) else {
            resolve(call, ok: false, error: "Printer port must be between 1 and 65535.")
            return
        }
        guard let encoded = call.getString("data"),
              let data = Data(base64Encoded: encoded),
              !data.isEmpty else {
            resolve(call, ok: false, error: "Print data must be non-empty base64.")
            return
        }

        let connection = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
        let queue = DispatchQueue(label: "com.anouti.pos.tcp-printer")
        let lock = NSLock()
        var finished = false
        let finish: (String?) -> Void = { error in
            lock.lock()
            if finished {
                lock.unlock()
                return
            }
            finished = true
            lock.unlock()
            connection.cancel()
            self.resolve(call, ok: error == nil, error: error)
        }
        let timeout = DispatchWorkItem {
            finish("Timed out sending data to printer at \(host):\(portValue).")
        }

        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                connection.send(content: data, completion: .contentProcessed { error in
                    timeout.cancel()
                    finish(error.map { "Could not send print data: \($0.localizedDescription)" })
                })
            case .failed(let error):
                timeout.cancel()
                finish("Could not connect to printer at \(host):\(portValue): \(error.localizedDescription)")
            case .cancelled, .setup, .preparing, .waiting:
                break
            @unknown default:
                finish("The printer connection entered an unknown state.")
            }
        }
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 5, execute: timeout)
        connection.start(queue: queue)
    }

    private func resolve(_ call: CAPPluginCall, ok: Bool, error: String? = nil) {
        var result: [String: Any] = ["ok": ok]
        if let error { result["error"] = error }
        call.resolve(result)
    }
}
