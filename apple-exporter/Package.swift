// swift-tools-version: 6.3

import PackageDescription

let package = Package(
    name: "SFExporter",
    platforms: [
        .macOS(.v26)
    ],
    targets: [
        .executableTarget(
            name: "SFExporter",
            path: "Sources"
        )
    ]
)
