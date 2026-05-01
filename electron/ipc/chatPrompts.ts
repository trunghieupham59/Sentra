const DEFAULT_CHAT_SYSTEM_PROMPT =
  'You are a helpful AI assistant. Be concise, friendly, and accurate.'

const CHAT_SYSTEM_PROMPT_ENFORCEMENT =
  'IMPORTANT: You MUST strictly follow the instructions above in every response. Do not deviate, explain or refuse these instructions. Apply them to all messages unconditionally.'

export function buildEnforcedSystemPrompt(userPrompt: string): string {
  const trimmedPrompt = userPrompt.trim()
  if (!trimmedPrompt) return DEFAULT_CHAT_SYSTEM_PROMPT
  return `${trimmedPrompt}

${CHAT_SYSTEM_PROMPT_ENFORCEMENT}`
}

export function buildChatImageEditPrompt(prompt: string): string {
  return `Edit the attached image according to this user request:
${prompt.trim()}

Return the edited image as the primary result. Preserve the subject identity, image quality, framing, lighting, and natural details unless the user explicitly asks to change them.`
}
