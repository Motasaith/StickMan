export const SETTING_FIELDS = [
  { key: "LLM_BASE_URL", label: "AI service address", secret: false, placeholder: "Your provider's OpenAI-compatible URL", help: "Paste the base URL supplied by your AI provider, including /v1 if required." },
  { key: "LLM_API_KEY", label: "AI API key", secret: true, placeholder: "Paste your AI provider's key", help: "Used for scripts and the AI Director. Local providers may not need a key." },
  { key: "LLM_MODEL", label: "AI model", secret: false, placeholder: "gpt-oss:120b", help: "Enter the model name from your provider." },
  { key: "VISION_LLM_MODEL", label: "Vision model (optional)", secret: false, placeholder: "Uses the AI model when empty", help: "A model that accepts images, for visual reviews and puppet setup." },
  { key: "PEXELS_API_KEY", label: "Pexels API key", secret: true, placeholder: "Optional", help: "Enables stock videos and photos. Other image sources work without a key." },
  { key: "YOUTUBE_API_KEY", label: "YouTube API key", secret: true, placeholder: "Optional", help: "A YouTube Data API v3 key enables real competition checks for video ideas." },
  { key: "POLLINATIONS_API_KEY", label: "Pollinations API key", secret: true, placeholder: "Optional", help: "Used by the AI picture service." },
  { key: "HF_TOKEN", label: "Hugging Face token", secret: true, placeholder: "Optional", help: "Enables AI pictures through Hugging Face inference." },
  { key: "HF_IMAGE_MODEL", label: "Hugging Face image model (optional)", secret: false, placeholder: "black-forest-labs/FLUX.1-schnell", help: "Leave empty to use the default image model." },
] as const;

export type SettingKey = typeof SETTING_FIELDS[number]["key"];
export type SettingsStatus = Record<SettingKey, { configured: boolean; value?: string }>;
