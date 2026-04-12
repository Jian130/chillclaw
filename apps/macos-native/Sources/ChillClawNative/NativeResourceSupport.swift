import Foundation

private let nativeSwiftPackageResourceBundleName = "ChillClawNative_ChillClawNative.bundle"
private final class NativeResourceBundleToken: NSObject {}

func nativeBundledResourceURL(
    forResource name: String,
    withExtension extensionName: String,
    resourceRoots: [URL] = nativeResourceRootCandidates()
) -> URL? {
    nativeBundledResourceURL(forResource: name, withExtensions: [extensionName], resourceRoots: resourceRoots)
}

func nativeBundledResourceURL(
    forResource name: String,
    withExtensions extensionNames: [String],
    resourceRoots: [URL] = nativeResourceRootCandidates()
) -> URL? {
    let bundles = nativeResourceBundles(resourceRoots: resourceRoots)

    for extensionName in extensionNames {
        for root in resourceRoots {
            let rootCandidate = root.appendingPathComponent("\(name).\(extensionName)")
            if FileManager.default.fileExists(atPath: rootCandidate.path) {
                return rootCandidate
            }

            let bundleCandidate = root
                .appendingPathComponent(nativeSwiftPackageResourceBundleName)
                .appendingPathComponent("\(name).\(extensionName)")
            if FileManager.default.fileExists(atPath: bundleCandidate.path) {
                return bundleCandidate
            }
        }

        for bundle in bundles {
            if let url = bundle.url(forResource: name, withExtension: extensionName) {
                return url
            }
        }
    }

    return nil
}

private func nativeResourceBundles(resourceRoots: [URL]) -> [Bundle] {
    var bundles: [Bundle] = []

    appendUniqueBundle(Bundle.main, to: &bundles)
    appendUniqueBundle(Bundle(for: NativeResourceBundleToken.self), to: &bundles)
    for bundle in Bundle.allBundles {
        appendUniqueBundle(bundle, to: &bundles)
    }
    for bundle in Bundle.allFrameworks {
        appendUniqueBundle(bundle, to: &bundles)
    }

    for root in resourceRoots {
        if root.lastPathComponent == nativeSwiftPackageResourceBundleName,
           let bundle = Bundle(url: root)
        {
            appendUniqueBundle(bundle, to: &bundles)
        }

        let bundleURL = root.appendingPathComponent(nativeSwiftPackageResourceBundleName)
        if let bundle = Bundle(url: bundleURL) {
            appendUniqueBundle(bundle, to: &bundles)
        }
    }

    return bundles
}

private func nativeResourceRootCandidates() -> [URL] {
    var roots: [URL] = []

    appendResourceRoots(around: Bundle.main.resourceURL, to: &roots)
    appendResourceRoots(around: Bundle.main.bundleURL, to: &roots)
    let codeBundle = Bundle(for: NativeResourceBundleToken.self)
    appendResourceRoots(around: codeBundle.resourceURL, to: &roots)
    appendResourceRoots(around: codeBundle.bundleURL, to: &roots)

    let executableURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
    appendResourceRoots(around: executableURL.deletingLastPathComponent(), to: &roots)

    return roots
}

private func appendResourceRoots(around url: URL?, to roots: inout [URL]) {
    guard let url else {
        return
    }

    var ancestor = url.standardizedFileURL
    for _ in 0..<8 {
        appendUniqueURL(ancestor, to: &roots)
        appendUniqueURL(ancestor.appendingPathComponent("Resources"), to: &roots)

        let parent = ancestor.deletingLastPathComponent()
        guard parent.standardizedFileURL.path != ancestor.standardizedFileURL.path else {
            break
        }
        ancestor = parent
    }
}

private func appendUniqueBundle(_ bundle: Bundle, to bundles: inout [Bundle]) {
    let path = bundle.bundleURL.standardizedFileURL.path
    guard !bundles.contains(where: { $0.bundleURL.standardizedFileURL.path == path }) else {
        return
    }
    bundles.append(bundle)
}

private func appendUniqueURL(_ url: URL?, to urls: inout [URL]) {
    guard let url else {
        return
    }
    let standardized = url.standardizedFileURL
    guard !urls.contains(where: { $0.standardizedFileURL.path == standardized.path }) else {
        return
    }
    urls.append(standardized)
}
