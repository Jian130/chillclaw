import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateSpy
}));

vi.mock("../../app/providers/LocaleProvider.js", () => ({
  useLocale: () => ({ locale: "en" })
}));

vi.mock("../../app/providers/OverviewProvider.js", () => ({
  useOverview: () => ({
    overview: {
      appUpdate: {
        status: "update-available",
        supported: true,
        currentVersion: "0.1.2",
        latestVersion: "0.1.4",
        downloadUrl: "https://github.com/Jian130/chillclaw/releases/download/v0.1.4/ChillClaw-macOS.dmg",
        releaseUrl: "https://github.com/Jian130/chillclaw/releases/tag/v0.1.4",
        checkedAt: "2026-04-04T11:00:00.000Z",
        summary: "ChillClaw 0.1.4 is available.",
        detail: "Download the latest disk image."
      },
      appService: {
        running: true,
        summary: "ChillClaw launches as a local background service."
      },
      runtimeManager: {
        checkedAt: "2026-04-04T11:00:00.000Z",
        summary: "Runtime updates are ready to apply.",
        detail: "ChillClaw manages pinned runtimes through a curated manifest.",
        resources: [
          {
            id: "openclaw-runtime",
            kind: "engine",
            label: "OpenClaw runtime",
            status: "ready",
            sourcePolicy: ["bundled", "download"],
            updatePolicy: "stage-silently-apply-safely",
            installedVersion: "2026.3.11",
            desiredVersion: "2026.3.11",
            latestApprovedVersion: "2026.4.13",
            updateAvailable: true,
            blockingResourceIds: ["node-npm-runtime"],
            summary: "OpenClaw runtime has an approved update.",
            detail: "ChillClaw can update its managed local OpenClaw runtime."
          }
        ]
      }
    },
    refresh: async () => undefined
  })
}));

vi.mock("../../app/providers/WorkspaceProvider.js", () => ({
  useWorkspace: () => ({
    state: {
      settings: {
        general: {
          instanceName: "Test workspace",
          autoStart: true,
          checkUpdates: true,
          telemetry: false
        },
        logging: {
          level: "info",
          retention: 14,
          enableDebug: false
        }
      }
    },
    update: () => undefined
  })
}));

import SettingsPage from "./SettingsPage.js";

describe("SettingsPage", () => {
  it("shows the permissions guidance card in the general settings tab", () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain("Permissions");
    expect(html).toContain("Automation, Notifications, Accessibility, Screen Recording");
    expect(html).toContain("Manage this in the native macOS app");
    expect(html).toContain("App Updates");
    expect(html).toContain("OpenClaw Runtime");
    expect(html).toContain("ChillClaw updates its managed OpenClaw runtime inside the app boundary");
    expect(html).toContain("OpenClaw runtime has an approved update.");
    expect(html).toContain("2026.3.11");
    expect(html).toContain("2026.4.13");
    expect(html).toContain("Update OpenClaw");
    expect(html).toContain("Local AI on This Mac");
    expect(html).toContain("Download 0.1.4");
  });
});
