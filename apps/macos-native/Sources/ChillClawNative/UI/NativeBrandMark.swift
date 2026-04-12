import AppKit
import SwiftUI

enum NativeBrandMarkSize {
    case loadingHero
    case onboarding
    case sidebar

    var containerSize: CGFloat {
        switch self {
        case .loadingHero: return 76
        case .onboarding: return 56
        case .sidebar: return 72
        }
    }

    var imageWidth: CGFloat {
        switch self {
        case .loadingHero: return 60
        case .onboarding: return 46
        case .sidebar: return 58
        }
    }
}

struct NativeBrandMark: View {
    let size: NativeBrandMarkSize

    var body: some View {
        ZStack {
            if let logoImage = nativeBrandLogoImage() {
                Image(nsImage: logoImage)
                    .resizable()
                    .scaledToFit()
                    .frame(width: size.imageWidth)
            }
        }
        .frame(width: size.containerSize, height: size.containerSize)
        .accessibilityHidden(true)
    }
}

@MainActor
func nativeBrandLogoImage() -> NSImage? {
    guard
        let logoURL = Bundle.module.url(forResource: "ChillClawBrandLogo", withExtension: "png")
    else {
        return nil
    }

    return NSImage(contentsOf: logoURL)
}
