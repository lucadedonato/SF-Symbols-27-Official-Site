import AppKit
import Foundation

@main
struct SFExporter {
    static func main() {
        let symbolName = "folder"

        guard let image = NSImage(
            systemSymbolName: symbolName,
            accessibilityDescription: symbolName
        ) else {
            fputs("ERROR: symbol not available: \(symbolName)\n", stderr)
            exit(1)
        }

        let outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("output")

        do {
            try FileManager.default.createDirectory(
                at: outputDirectory,
                withIntermediateDirectories: true
            )

            let outputURL = outputDirectory.appendingPathComponent("\(symbolName).png")

            guard
                let tiffData = image.tiffRepresentation,
                let bitmap = NSBitmapImageRep(data: tiffData),
                let pngData = bitmap.representation(using: .png, properties: [:])
            else {
                throw NSError(
                    domain: "SFExporter",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Could not create PNG"]
                )
            }

            try pngData.write(to: outputURL)

            print("SUCCESS")
            print("Symbol: \(symbolName)")
            print("Output: \(outputURL.path)")
        } catch {
            fputs("ERROR: \(error)\n", stderr)
            exit(1)
        }
    }
}
