import Foundation

extension Foundation.Bundle {
    static let module: Bundle = {
        let mainPath = Bundle.main.bundleURL.appendingPathComponent("SlackClawNative_SlackClawNative.bundle").path
        let buildPath = "/Users/home/Ryo/Projects/slackclaw/apps/macos-native/.build/arm64-apple-macosx/release/SlackClawNative_SlackClawNative.bundle"

        let preferredBundle = Bundle(path: mainPath)

        guard let bundle = preferredBundle ?? Bundle(path: buildPath) else {
            // Users can write a function called fatalError themselves, we should be resilient against that.
            Swift.fatalError("could not load resource bundle: from \(mainPath) or \(buildPath)")
        }

        return bundle
    }()
}