import Foundation
import SlackClawProtocol

enum NativeConfigurationChannelPrimaryAction: Equatable {
    case edit
    case continueSetup
}

struct NativeConfigurationChannelActionState: Equatable {
    var primaryAction: NativeConfigurationChannelPrimaryAction
    var showApproveAction: Bool
}

enum NativeConfigurationChannelSheetAction: Equatable {
    case save
    case approvePairing
}

func configurationChannelActionState(
    entry: ConfiguredChannelEntry,
    capability: ChannelCapability?
) -> NativeConfigurationChannelActionState {
    NativeConfigurationChannelActionState(
        primaryAction: entry.pairingRequired ? .continueSetup : .edit,
        showApproveAction: capability?.supportsPairing == true
    )
}

func buildConfigurationChannelRequest(
    channelId: String,
    entryId: String?,
    editableValues: [String: String],
    action: NativeConfigurationChannelSheetAction,
    pairingCode: String = ""
) -> SaveChannelEntryRequest {
    var values = editableValues

    if action == .approvePairing {
        values["code"] = pairingCode.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    return SaveChannelEntryRequest(
        channelId: channelId,
        entryId: entryId,
        values: values,
        action: action == .approvePairing ? "approve-pairing" : "save"
    )
}
