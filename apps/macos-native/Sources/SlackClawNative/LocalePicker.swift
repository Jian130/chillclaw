import SwiftUI

struct NativeLocalePicker: View {
    let selected: NativeOnboardingLocaleOption
    let options: [NativeOnboardingLocaleOption]
    let onSelect: (String) -> Void

    var body: some View {
        Menu {
            ForEach(options) { option in
                Button("\(option.flag) \(option.label)") {
                    onSelect(option.id)
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "globe")
                    .font(.system(size: 14, weight: .semibold))
                Text("\(selected.flag) \(selected.label)")
                    .font(.system(size: 14, weight: .medium))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: NativeUI.iconCornerRadius, style: .continuous)
                    .fill(Color.white.opacity(0.88))
                    .overlay(
                        RoundedRectangle(cornerRadius: NativeUI.iconCornerRadius, style: .continuous)
                            .strokeBorder(Color.black.opacity(0.08))
                    )
            )
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }
}
