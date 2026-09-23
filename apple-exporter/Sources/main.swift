import AppKit
import Foundation
import Symbols

@MainActor
final class CaptureApp: NSObject, NSApplicationDelegate {
    private let symbolName = "folder"
    private let frameRate = 60.0
    private let captureDuration = 1.5
    private let canvasSize = CGSize(width: 256, height: 256)

    private var window: NSWindow!
    private var imageView: NSImageView!
    private var timer: Timer?
    private var frameIndex = 0
    private var outputDirectory: URL!

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let image = NSImage(systemSymbolName: symbolName, accessibilityDescription: symbolName) else {
            fail("Symbol unavailable in the macOS system catalog: \(symbolName)")
            return
        }

        outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("output", isDirectory: true)
            .appendingPathComponent("bounce", isDirectory: true)

        do {
            try FileManager.default.removeItemIfExists(at: outputDirectory)
            try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
        } catch {
            fail("Could not prepare output directory: \(error)")
            return
        }

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

        // Core Animation needs the view attached to a real window render tree.
        window.orderBack(nil)
        window.displayIfNeeded()

        // This is Apple's Symbols framework effect. No browser/CSS animation is synthesized here.
        imageView.addSymbolEffect(.bounce, options: .nonRepeating)

        let interval = 1.0 / frameRate
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] timer in
            Task { @MainActor in
                self?.captureFrame(timer: timer)
            }
        }
        RunLoop.main.add(timer!, forMode: .common)
    }

    private func captureFrame(timer: Timer) {
        let totalFrames = Int(ceil(captureDuration * frameRate))
        if frameIndex >= totalFrames {
            timer.invalidate()
            finish(totalFrames: totalFrames)
            return
        }

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
        let manifest: [String: Any] = [
            "source": "Apple Symbols.framework",
            "symbol": symbolName,
            "effect": "bounce",
            "frames": totalFrames,
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
            NSApp.terminate(nil)
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
app.setActivationPolicy(.prohibited)
app.run()
