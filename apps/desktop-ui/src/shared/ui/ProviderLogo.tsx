import {
  siAlibabacloud,
  siAnthropic,
  siCloudflare,
  siGithub,
  siGithubcopilot,
  siGoogle,
  siGooglegemini,
  siHuggingface,
  siMinimax,
  siMistralai,
  siNvidia,
  siOllama,
  siOpenrouter,
  siVercel
} from "simple-icons";

type SimpleIcon = {
  title: string;
  hex: string;
  path: string;
};

const openAiBrand: SimpleIcon = {
  title: "OpenAI",
  hex: "000000",
  path: "M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"
};

const bedrockBrand: SimpleIcon = {
  title: "Amazon Bedrock",
  hex: "222F3E",
  path: "M13.05 15.513h3.08c.214 0 .389.177.389.394v1.82a1.704 1.704 0 011.296 1.661c0 .943-.755 1.708-1.685 1.708-.931 0-1.686-.765-1.686-1.708 0-.807.554-1.484 1.297-1.662v-1.425h-2.69v4.663a.395.395 0 01-.188.338l-2.69 1.641a.385.385 0 01-.405-.002l-4.926-3.086a.395.395 0 01-.185-.336V16.3L2.196 14.87A.395.395 0 012 14.555L2 14.528V9.406c0-.14.073-.27.192-.34l2.465-1.462V4.448c0-.129.062-.249.165-.322l.021-.014L9.77 1.058a.385.385 0 01.407 0l2.69 1.675a.395.395 0 01.185.336V7.6h3.856V5.683a1.704 1.704 0 01-1.296-1.662c0-.943.755-1.708 1.685-1.708.931 0 1.685.765 1.685 1.708 0 .807-.553 1.484-1.296 1.662v2.311a.391.391 0 01-.389.394h-4.245v1.806h6.624a1.69 1.69 0 011.64-1.313c.93 0 1.685.764 1.685 1.707 0 .943-.754 1.708-1.685 1.708a1.69 1.69 0 01-1.64-1.314H13.05v1.937h4.953l.915 1.18a1.66 1.66 0 01.84-.227c.931 0 1.685.764 1.685 1.707 0 .943-.754 1.708-1.685 1.708-.93 0-1.685-.765-1.685-1.708 0-.346.102-.668.276-.937l-.724-.935H13.05v1.806zM9.973 1.856L7.93 3.122V6.09h-.778V3.604L5.435 4.669v2.945l2.11 1.36L9.712 7.61V5.334h.778V7.83c0 .136-.07.263-.184.335L7.963 9.638v2.081l1.422 1.009-.446.646-1.406-.998-1.53 1.005-.423-.66 1.605-1.055v-1.99L5.038 8.29l-2.26 1.34v1.676l1.972-1.189.398.677-2.37 1.429V14.3l2.166 1.258 2.27-1.368.397.677-2.176 1.311V19.3l1.876 1.175 2.365-1.426.398.678-2.017 1.216 1.918 1.201 2.298-1.403v-5.78l-4.758 2.893-.4-.675 5.158-3.136V3.289L9.972 1.856zM16.13 18.47a.913.913 0 00-.908.92c0 .507.406.918.908.918a.913.913 0 00.907-.919.913.913 0 00-.907-.92zm3.63-3.81a.913.913 0 00-.908.92c0 .508.406.92.907.92a.913.913 0 00.908-.92.913.913 0 00-.908-.92zm1.555-4.99a.913.913 0 00-.908.92c0 .507.407.918.908.918a.913.913 0 00.907-.919.913.913 0 00-.907-.92zM17.296 3.1a.913.913 0 00-.907.92c0 .508.406.92.907.92a.913.913 0 00.908-.92.913.913 0 00-.908-.92z"
};

const providerGlyphs: Record<string, string> = {
  openai: "OA",
  "openai-codex": "OC",
  anthropic: "AN",
  gemini: "GE",
  google: "GE",
  github: "GH",
  githubcopilot: "GH",
  "github-copilot": "GH",
  feishu: "飞"
};

const providerBrands: Record<string, SimpleIcon> = {
  openai: openAiBrand,
  "openai-codex": openAiBrand,
  anthropic: siAnthropic,
  gemini: siGooglegemini,
  google: siGoogle,
  github: siGithub,
  githubcopilot: siGithubcopilot,
  "github-copilot": siGithubcopilot,
  huggingface: siHuggingface,
  mistral: siMistralai,
  ollama: siOllama,
  openrouter: siOpenrouter,
  nvidia: siNvidia,
  minimax: siMinimax,
  qwen: siAlibabacloud,
  "amazon-bedrock": bedrockBrand,
  "cloudflare-ai-gateway": siCloudflare,
  "vercel-ai-gateway": siVercel
};

function tintHex(hex: string, alpha: number) {
  const normalized = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(15, 23, 42, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function providerFallbackGlyph(providerId: string) {
  return providerGlyphs[providerId] ?? providerId.slice(0, 2).toUpperCase();
}

export function providerBrandInfo(providerId: string) {
  const icon = providerBrands[providerId];
  if (!icon) {
    return undefined;
  }

  return {
    title: icon.title,
    hex: `#${icon.hex}`,
    path: icon.path
  };
}

type ProviderLogoProps = {
  providerId: string;
  label?: string;
};

export function ProviderLogo({ providerId, label }: ProviderLogoProps) {
  const brand = providerBrandInfo(providerId);
  if (!brand) {
    return (
      <div aria-hidden="true" className="provider-logo provider-logo--fallback" title={label ?? providerId}>
        {providerFallbackGlyph(providerId)}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="provider-logo provider-logo--brand"
      style={{
        color: brand.hex,
        backgroundColor: tintHex(brand.hex, 0.12),
        borderColor: tintHex(brand.hex, 0.22)
      }}
      title={label ?? brand.title}
    >
      <svg fill="none" viewBox="0 0 24 24">
        <path d={brand.path} fill="currentColor" />
      </svg>
    </div>
  );
}
