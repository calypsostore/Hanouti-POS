// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TcpPrinter",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "TcpPrinter", targets: ["TcpPrinter"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.2")
    ],
    targets: [
        .target(
            name: "TcpPrinter",
            path: "ios/Sources/TcpPrinterPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ]
        )
    ]
)
