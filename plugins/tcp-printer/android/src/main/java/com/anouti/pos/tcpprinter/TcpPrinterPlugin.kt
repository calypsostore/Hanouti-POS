package com.anouti.pos.tcpprinter

import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

@CapacitorPlugin(name = "TcpPrinter")
class TcpPrinterPlugin : Plugin() {
    @PluginMethod
    fun send(call: PluginCall) {
        val host = call.getString("host")?.trim()
        val port = call.getInt("port", 9100) ?: 9100
        val encoded = call.getString("data")
        if (host.isNullOrEmpty()) {
            resolveError(call, "Printer host is required.")
            return
        }
        if (port !in 1..65535) {
            resolveError(call, "Printer port must be between 1 and 65535.")
            return
        }
        val bytes = try {
            if (encoded.isNullOrEmpty()) throw IllegalArgumentException("Print data is empty.")
            Base64.decode(encoded, Base64.DEFAULT)
        } catch (error: IllegalArgumentException) {
            resolveError(call, error.message ?: "Print data is not valid base64.")
            return
        }

        val socket = Socket()
        val executor = Executors.newSingleThreadExecutor()
        val task = executor.submit {
            socket.use {
                it.connect(InetSocketAddress(host, port), TIMEOUT_MS)
                it.soTimeout = TIMEOUT_MS
                it.getOutputStream().use { output ->
                    output.write(bytes)
                    output.flush()
                }
            }
        }
        try {
            task.get(TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
            call.resolve(JSObject().put("ok", true))
        } catch (error: TimeoutException) {
            socket.close()
            resolveError(call, "Timed out sending data to printer at $host:$port.")
        } catch (error: Exception) {
            socket.close()
            val cause = error.cause ?: error
            resolveError(call, "Could not print to $host:$port: ${cause.message ?: "connection failed"}.")
        } finally {
            executor.shutdownNow()
        }
    }

    private fun resolveError(call: PluginCall, message: String) {
        call.resolve(JSObject().put("ok", false).put("error", message))
    }

    private companion object {
        const val TIMEOUT_MS = 5_000
    }
}
