import type { VoiceId } from "./scene";

/** Speaking voices, backed by Microsoft Edge neural TTS on the server. */
export const VOICES: Record<VoiceId, { label: string; edge: string; pitch: string; rate: string }> = {
  man: { label: "Man", edge: "en-US-AndrewMultilingualNeural", pitch: "+0Hz", rate: "+0%" },
  woman: { label: "Woman", edge: "en-US-AvaMultilingualNeural", pitch: "+0Hz", rate: "+0%" },
  boy: { label: "Boy", edge: "en-US-GuyNeural", pitch: "+45Hz", rate: "+8%" },
  girl: { label: "Girl", edge: "en-US-AnaNeural", pitch: "+0Hz", rate: "+0%" },
  oldMan: { label: "Old man", edge: "en-GB-RyanNeural", pitch: "-12Hz", rate: "-12%" },
  oldWoman: { label: "Old woman", edge: "en-GB-SoniaNeural", pitch: "-8Hz", rate: "-12%" },
  robot: { label: "Robot", edge: "en-US-SteffanNeural", pitch: "-30Hz", rate: "-5%" },
  narrator: { label: "Narrator", edge: "en-US-BrianMultilingualNeural", pitch: "+0Hz", rate: "-4%" },
  urduMan: { label: "Urdu man", edge: "ur-PK-AsadNeural", pitch: "+0Hz", rate: "+0%" },
  urduWoman: { label: "Urdu woman", edge: "ur-PK-UzmaNeural", pitch: "+0Hz", rate: "+0%" },
  dog: { label: "Dog (cartoon)", edge: "en-US-GuyNeural", pitch: "+25Hz", rate: "+15%" },
  cat: { label: "Cat (cartoon)", edge: "en-US-AnaNeural", pitch: "+40Hz", rate: "+5%" },
  bird: { label: "Bird (cartoon)", edge: "en-US-AnaNeural", pitch: "+90Hz", rate: "+20%" },
};
