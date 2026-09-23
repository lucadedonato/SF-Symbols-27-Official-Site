// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SFExporter",
    platforms: [
        .macOS(.v15)
    ],
    targets: [
        .executableTarget(
            name: "SFExporter",
            path: "Sources"
        )
    ]
)
