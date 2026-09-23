import AppKit
import Foundation
import Symbols

@MainActor
final class CaptureApp: NSObject, NSApplicationDelegate {
    private let frameRate = 60.0
    private let captureDuration = 1.5
    private let symbolsToExport = [
        "folder",
        "folder.fill",
        "folder.circle",
        "folder.circle.fill",
        "folder.and.person",
        "folder.and.person.fill",
        "folder.badge.plus",
        "folder.fill.badge.plus",
        "folder.badge.minus",
        "folder.fill.badge.minus",
        "folder.badge.person.crop",
        "folder.fill.badge.person.crop",
        "questionmark.folder",
        "arrow.forward.folder",
        "arrow.forward.folder.fill",
        "plus.rectangle.on.folder",
        "plus.rectangle.on.folder.fill"
    ]
    private let canvasSize = CGSize(width: 256, height: 256)

    private var window: NSWindow!
    private var imageView: NSImageView!
    private var displayLink: CADisplayLink?
    private var frameIndex = 0
    private var frameFingerprints = Set<Data>()
    private var outputDirectory: URL!
    private var currentSymbolIndex = 0

    func applicationDidFinishLaunching(_ notification: Notification) {
        startCurrentSymbol()
    }

    private func startCurrentSymbol() {
        guard currentSymbolIndex < symbolsToExport.count else {
            print("ALL_EXPORTS_COMPLETE")
            NSApp.terminate(nil)
            return
        }

        let symbolName = symbolsToExport[currentSymbolIndex]
        guard let image = NSImage(systemSymbolName: symbolName, accessibilityDescription: symbolName) else {
            print("SKIP: Symbol unavailable in macOS system catalog: \(symbolName)")
            currentSymbolIndex += 1
            startCurrentSymbol()
            return
        }

        outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("output", isDirectory: true)
            .appendingPathComponent("bounce", isDirectory: true)
            .appendingPathComponent(symbolName, isDirectory: true)

        do {
            try FileManager.default.removeItemIfExists(at: outputDirectory)
            try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
        } catch {
            fail("Could not prepare output directory: \(error)")
            return
        }

        frameIndex = 0
        frameFingerprints.removeAll()

        window = NSWindow(
            contentRect: CGRect(origin: .zero, size: canvasSize),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.backgroundColor = .clear
        window.isOpaque = false

        let host = NSView(frame: CGRect(origin: .zero, size: canvasSize))
        host.wantsLayer = true
        host.layer?.backgroundColor = NSColor.clear.cgColor
        window.contentView = host

        imageView = NSImageView(frame: host.bounds)
        imageView.imageScaling = .scaleProportionallyUpOrDown
        imageView.image = image.withSymbolConfiguration(
            NSImage.SymbolConfiguration(pointSize: 160, weight: .regular)
        )
        imageView.contentTintColor = .black
        imageView.wantsLayer = true
        host.addSubview(imageView)

        // Symbol effects only advance while the view participates in a real window render tree.
        window.makeKeyAndOrderFront(nil)
        window.displayIfNeeded()

        // Apple's Symbols.framework executes the effect. We do not synthesize keyframes.
        imageView.removeAllSymbolEffects()
        imageView.addSymbolEffect(.bounce, options: .nonRepeating)

        // Capture on the actual display refresh, as recommended for AppKit drawing.
        let link = imageView.displayLink(target: self, selector: #selector(captureTick(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    @objc private func captureTick(_ link: CADisplayLink) {
        captureFrame()
    }

    private func captureFrame() {
        let totalFrames = Int(ceil(captureDuration * frameRate))
        if frameIndex >= totalFrames {
            displayLink?.invalidate()
            displayLink = nil
            finish(totalFrames: totalFrames)
            return
        }

        // Render the effect's current layer contents, as updated by Apple's runtime.
        imageView.displayIfNeeded()
        guard let layer = imageView.layer else {
            fail("NSImageView has no backing layer")
            return
        }

        let width = Int(canvasSize.width)
        let height = Int(canvasSize.height)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            fail("Could not create CGContext")
            return
        }

        context.clear(CGRect(origin: .zero, size: canvasSize))
        layer.render(in: context)
        if let rawPixels = context.data {
            frameFingerprints.insert(Data(bytes: rawPixels, count: context.bytesPerRow * height))
        }

        guard let cgImage = context.makeImage() else {
            fail("Could not create CGImage frame")
            return
        }

        let bitmap = NSBitmapImageRep(cgImage: cgImage)
        guard let png = bitmap.representation(using: .png, properties: [:]) else {
            fail("Could not encode PNG frame")
            return
        }

        let frameURL = outputDirectory.appendingPathComponent(String(format: "frame-%04d.png", frameIndex))
        do {
            try png.write(to: frameURL)
        } catch {
            fail("Could not write frame: \(error)")
            return
        }

        frameIndex += 1
    }

    private func finish(totalFrames: Int) {
        let symbolName = symbolsToExport[currentSymbolIndex]
        let uniqueFrames = frameFingerprints.count
        print("Distinct pixel frames for \(symbolName): \(uniqueFrames) / \(frameIndex)")
        guard uniqueFrames >= 6 else {
            print("SKIP_INVALID: \(symbolName) produced only \(uniqueFrames) distinct pixel frames")
            currentSymbolIndex += 1
            startCurrentSymbol()
            return
        }

        let manifest: [String: Any] = [
            "source": "Apple Symbols.framework",
            "symbol": symbolName,
            "effect": "bounce",
            "frames": totalFrames,
            "uniquePixelFrames": uniqueFrames,
            "fps": frameRate,
            "durationSeconds": captureDuration,
            "canvas": ["width": Int(canvasSize.width), "height": Int(canvasSize.height)],
            "note": "Frames captured from the macOS Symbols.framework effect; no reconstructed CSS/keyframe animation."
        ]

        do {
            let data = try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: outputDirectory.appendingPathComponent("manifest.json"))
            print("SUCCESS")
            print("Symbol: \(symbolName)")
            print("Effect: bounce")
            print("Captured frames: \(frameIndex)")
            print("Output: \(outputDirectory.path)")
            currentSymbolIndex += 1
            startCurrentSymbol()
        } catch {
            fail("Could not write manifest: \(error)")
        }
    }

    private func fail(_ message: String) {
        fputs("ERROR: \(message)\n", stderr)
        NSApp.terminate(nil)
        exit(1)
    }
}

private extension FileManager {
    func removeItemIfExists(at url: URL) throws {
        if fileExists(atPath: url.path) {
            try removeItem(at: url)
        }
    }
}

let app = NSApplication.shared
let delegate = CaptureApp()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
