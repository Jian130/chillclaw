export type Locale = "en" | "zh" | "ja" | "ko" | "es";

export const localeOptions = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "zh", label: "中文", flag: "🇨🇳" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "es", label: "Español", flag: "🇪🇸" }
] satisfies Array<{ value: Locale; label: string; flag: string }>;

type TranslationTree = {
  common: Record<string, string>;
  shell: Record<string, string>;
  onboarding: Record<string, string>;
  deploy: Record<string, string>;
  config: Record<string, string>;
  dashboard: Record<string, string>;
  chat: Record<string, string>;
  team: Record<string, string>;
  skills: Record<string, string>;
  settings: Record<string, string>;
};

const en: TranslationTree = {
  common: {
    loading: "Loading",
    connecting: "Connecting",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    back: "Back",
    continue: "Continue",
    retry: "Retry",
    refresh: "Refresh",
    comingSoon: "Planned",
    enabled: "Enabled",
    disabled: "Disabled"
  },
  shell: {
    dashboard: "Dashboard",
    onboarding: "Onboarding",
    deploy: "Deploy",
    config: "Configuration",
    skills: "Skills Management",
    chat: "Digital Employees",
    team: "Digital Team",
    settings: "Settings",
    status: "Status",
    active: "Active",
    attention: "Needs attention",
    setupRequired: "Needs setup"
  },
  onboarding: {
    title: "Welcome to SlackClaw",
    subtitle: "Build your OpenClaw-powered digital employee workspace in one guided flow.",
    stepOneTitle: "Get your workspace ready",
    stepOneBody: "SlackClaw checks this Mac, reuses OpenClaw when possible, and keeps the install path simple for ordinary users.",
    stepTwoTitle: "System environment check",
    stepTwoBody: "These checks come from the SlackClaw daemon, not mock requirements.",
    featureOne: "One-click deployment",
    featureTwo: "Guided configuration",
    featureThree: "Digital employee workspace",
    featureOneBody: "Deploy OpenClaw without terminal work for normal use.",
    featureTwoBody: "Complete onboarding, models, channels, and gateway setup in order.",
    featureThreeBody: "Build reusable digital employees for office workflows.",
    start: "Get My Workspace Ready",
    runChecks: "Check System Requirements",
    doneTitle: "System check complete",
    doneBody: "Your environment is ready. Continue to Deploy."
  },
  deploy: {
    title: "Deploy OpenClaw",
    subtitle: "Choose a deployment target and keep the engine behind SlackClaw’s guided experience.",
    infoTitle: "One-click deployment",
    infoBody: "SlackClaw uses the real setup API and shows the actual deployment steps returned by the daemon.",
    variantStandard: "OpenClaw Standard",
    variantLocal: "OpenClaw Managed Local",
    variantZero: "ZeroClaw",
    variantIron: "IronClaw",
    variantStandardBody: "Reuse an existing compatible OpenClaw install when available.",
    variantLocalBody: "Deploy a SlackClaw-managed local runtime under the app data directory.",
    variantPlannedBody: "Reserved future engine adapter target.",
    deployNow: "Deploy Now",
    deploying: "Deploying OpenClaw...",
    progressTitle: "Deployment progress",
    completion: "Deployment is complete. Continue to Configuration for onboarding and channels.",
    uninstall: "Uninstall OpenClaw"
  },
  config: {
    title: "Configuration",
    subtitle: "Configure AI models and communication channels.",
    modelsTab: "AI Models",
    channelsTab: "Channels",
    modelsInfoTitle: "AI model configuration",
    modelsInfoBody: "SlackClaw reads the live OpenClaw model catalog and keeps provider status truthful to the installed engine.",
    channelsInfoTitle: "Communication channels",
    channelsInfoBody: "Complete onboarding first, then configure official and workaround channels one by one.",
    addModel: "Add New Model",
    addModelTitle: "Add AI Model",
    selectedProvider: "Selected provider",
    model: "Model",
    authMethod: "Authentication method",
    configure: "Configure",
    configuring: "Configuring provider...",
    addModelAction: "Add Model",
    refreshProviders: "Refresh providers",
    docs: "Documentation",
    sourceInstalled: "Detected from installed OpenClaw",
    authProgress: "Authentication progress",
    finishAuth: "Finish authentication",
    pasteRedirect: "Paste the redirect URL or code",
    completeOnboarding: "Complete onboarding",
    onboardingDone: "Onboarding complete",
    completeOnboardingFirst: "Complete onboarding first",
    feishuPrepareTitle: "Prepare Feishu channel",
    feishuPrepareBody: "SlackClaw checks whether the current OpenClaw already includes the Feishu plugin before installing anything.",
    feishuSetupTitle: "Set up Feishu channel",
    gatewayStart: "Restart Gateway",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    feishu: "Feishu (飞书)",
    wechat: "WeChat workaround"
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Monitor SlackClaw, OpenClaw, and your digital employee workspace.",
    createEmployee: "Create Digital Employee",
    openTeam: "Open Digital Team",
    workspaceHealth: "Workspace Health",
    recentActivity: "Recent Activity",
    employeeStatus: "Digital Employee Status",
    quickActions: "Quick Actions"
  },
  chat: {
    title: "Build Your Digital Employee",
    subtitle: "Design identity, configure brain, and equip skills.",
    identity: "Digital Identity",
    brain: "AI Brain Configuration",
    library: "Skill Library",
    deployEmployee: "Deploy Now",
    saveDraft: "Save Draft"
  },
  team: {
    title: "Digital Team",
    subtitle: "Your AI workforce roster, chat surface, and task board.",
    vision: "Team Vision",
    createEmployee: "Create Another Employee",
    chat: "Chat",
    tasks: "Tasks"
  },
  skills: {
    title: "Skills Management",
    subtitle: "Manage preloaded skills and local custom drafts.",
    total: "Total Skills",
    enabled: "Enabled",
    preloaded: "Preloaded",
    custom: "Custom",
    addCustom: "Add Custom Skill"
  },
  settings: {
    title: "Settings",
    subtitle: "General preferences, deployment controls, logging, and advanced actions.",
    general: "General",
    deployment: "Deployment",
    logging: "Logging",
    advanced: "Advanced",
    exportDiagnostics: "Export Diagnostics",
    checkUpdates: "Check for Updates",
    installService: "Install Service",
    restartService: "Restart Service",
    removeService: "Remove Service",
    stopApp: "Stop SlackClaw",
    uninstallApp: "Uninstall SlackClaw"
  }
};

const partials: Partial<Record<Locale, Partial<TranslationTree>>> = {
  zh: {
    common: {
      loading: "加载中",
      connecting: "连接中",
      save: "保存",
      cancel: "取消",
      close: "关闭",
      back: "返回",
      continue: "继续",
      retry: "重试",
      refresh: "刷新",
      comingSoon: "计划中",
      enabled: "已启用",
      disabled: "已停用"
    },
    shell: {
      dashboard: "总览",
      onboarding: "引导",
      deploy: "部署",
      config: "配置",
      skills: "技能管理",
      chat: "数字员工",
      team: "数字团队",
      settings: "设置",
      status: "状态",
      active: "运行中",
      attention: "需要处理",
      setupRequired: "需要设置"
    }
  },
  ja: {
    common: {
      loading: "読み込み中",
      connecting: "接続中",
      save: "保存",
      cancel: "キャンセル",
      close: "閉じる",
      back: "戻る",
      continue: "続行",
      retry: "再試行",
      refresh: "更新",
      comingSoon: "予定",
      enabled: "有効",
      disabled: "無効"
    },
    shell: {
      dashboard: "ダッシュボード",
      onboarding: "オンボーディング",
      deploy: "デプロイ",
      config: "設定",
      skills: "スキル管理",
      chat: "デジタル従業員",
      team: "デジタルチーム",
      settings: "設定",
      status: "状態",
      active: "稼働中",
      attention: "要対応",
      setupRequired: "セットアップが必要"
    }
  },
  ko: {
    common: {
      loading: "불러오는 중",
      connecting: "연결 중",
      save: "저장",
      cancel: "취소",
      close: "닫기",
      back: "뒤로",
      continue: "계속",
      retry: "다시 시도",
      refresh: "새로고침",
      comingSoon: "예정",
      enabled: "활성",
      disabled: "비활성"
    },
    shell: {
      dashboard: "대시보드",
      onboarding: "온보딩",
      deploy: "배포",
      config: "구성",
      skills: "스킬 관리",
      chat: "디지털 직원",
      team: "디지털 팀",
      settings: "설정",
      status: "상태",
      active: "실행 중",
      attention: "확인 필요",
      setupRequired: "설정 필요"
    }
  },
  es: {
    common: {
      loading: "Cargando",
      connecting: "Conectando",
      save: "Guardar",
      cancel: "Cancelar",
      close: "Cerrar",
      back: "Atrás",
      continue: "Continuar",
      retry: "Reintentar",
      refresh: "Actualizar",
      comingSoon: "Planificado",
      enabled: "Activo",
      disabled: "Desactivado"
    },
    shell: {
      dashboard: "Panel",
      onboarding: "Onboarding",
      deploy: "Despliegue",
      config: "Configuración",
      skills: "Habilidades",
      chat: "Empleados digitales",
      team: "Equipo digital",
      settings: "Ajustes",
      status: "Estado",
      active: "Activo",
      attention: "Requiere atención",
      setupRequired: "Necesita configuración"
    }
  }
};

function merge(locale: Locale): TranslationTree {
  const patch = partials[locale];

  return {
    common: { ...en.common, ...(patch?.common ?? {}) },
    shell: { ...en.shell, ...(patch?.shell ?? {}) },
    onboarding: { ...en.onboarding, ...(patch?.onboarding ?? {}) },
    deploy: { ...en.deploy, ...(patch?.deploy ?? {}) },
    config: { ...en.config, ...(patch?.config ?? {}) },
    dashboard: { ...en.dashboard, ...(patch?.dashboard ?? {}) },
    chat: { ...en.chat, ...(patch?.chat ?? {}) },
    team: { ...en.team, ...(patch?.team ?? {}) },
    skills: { ...en.skills, ...(patch?.skills ?? {}) },
    settings: { ...en.settings, ...(patch?.settings ?? {}) }
  };
}

export function t(locale: Locale) {
  return locale === "en" ? en : merge(locale);
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem("slackclaw.locale");
  if (stored && localeOptions.some((option) => option.value === stored)) {
    return stored as Locale;
  }

  const browser = window.navigator.language.toLowerCase();
  if (browser.startsWith("zh")) return "zh";
  if (browser.startsWith("ja")) return "ja";
  if (browser.startsWith("ko")) return "ko";
  if (browser.startsWith("es")) return "es";
  return "en";
}
