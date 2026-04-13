export type AppLocale = 'en' | 'vi' | 'ja'

export interface Translations {
  // Navbar / Sidebar
  nav_translate: string
  nav_history: string
  nav_settings: string
  nav_new_chat: string
  nav_chat: string

  // Translate page
  translate_placeholder: string
  translate_result_placeholder: string
  translate_btn: string
  translate_btn_loading: string
  translate_clear: string
  translate_copy: string
  translate_copied: string
  translate_auto_indicator: string
  translate_manual_indicator: string
  translate_chars: string
  translate_limit: string
  translate_swap: string
  translate_error_no_key: string
  translate_error_open_settings: string
  translate_phonetic: string
  translate_style_label: string
  translate_style_friendly: string
  translate_style_neutral: string
  translate_style_professional: string
  translate_style_business: string
  translate_style_slack: string
  translate_style_polite: string
  translate_style_technical: string
  translate_speak: string
  translate_speak_stop: string

  // Voice recording
  voice_record: string
  voice_stop: string
  voice_listening: string
  voice_transcribing: string
  voice_whisper_mode: string

  // Model selector
  model_no_key: string
  model_loading: string
  model_load_error: string
  model_refresh: string

  // Language selector
  lang_auto: string
  /** Localized names for each language code (used in LanguageSelector) */
  lang_names: Record<string, string>

  // Settings page
  settings_title: string
  settings_subtitle: string
  settings_security_title: string
  settings_security_desc: string
  settings_security_macos: string
  settings_security_windows: string
  settings_api_keys: string
  settings_configured: string
  settings_get_key: string
  settings_key_saved: string
  settings_key_invalid: string
  settings_no_key: string
  settings_verify_save: string
  settings_verifying: string
  settings_verified: string
  settings_try_again: string
  settings_show: string
  settings_hide: string
  settings_remove: string
  settings_hint_verify: string
  settings_msg_valid: string
  settings_msg_rate_limited: string
  settings_msg_invalid: string
  settings_msg_network: string
  settings_prefs: string
  settings_auto_translate: string
  settings_auto_translate_desc: string
  settings_translate_delay: string
  settings_translate_delay_desc: string
  settings_translate_mode: string
  settings_translate_mode_desc: string
  settings_mode_auto: string
  settings_mode_manual: string
  settings_app_language: string
  settings_app_language_desc: string
  settings_locale_auto: string
  settings_locale_auto_desc: string
  settings_font_size: string
  settings_font_size_desc: string
  settings_font_size_small: string
  settings_font_size_medium: string
  settings_font_size_large: string
  settings_furigana: string
  settings_furigana_desc: string
  settings_tts_section: string
  settings_tts_voice: string
  settings_tts_voice_desc: string
  settings_tts_voice_alloy: string
  settings_tts_voice_echo: string
  settings_tts_voice_fable: string
  settings_tts_voice_onyx: string
  settings_tts_voice_nova: string
  settings_tts_voice_shimmer: string
  settings_about: string
  settings_about_version: string
  settings_about_platform: string
  settings_about_supports: string
  settings_about_footer: string

  // Image translation
  image_translate_title: string
  image_translate_btn: string
  image_translate_upload_hint: string
  image_translate_processing: string
  image_translate_no_text: string
  image_translate_download: string
  image_translate_result_label: string
  image_translate_change: string
  image_translate_error_no_key: string

  // History page
  history_title: string
  history_empty: string
  history_empty_desc: string
  history_clear_all: string
  history_clear_confirm: string
  history_delete: string
  history_reuse: string
  history_chars_source: string
  history_chars_result: string
  history_tab_translate: string
  history_tab_chat: string
  history_chat_empty: string
  history_chat_empty_desc: string
  history_chat_messages: string
  history_chat_open: string
  history_chat_delete: string

  // Live translate page
  nav_live_translate: string
  live_start: string
  live_stop: string
  live_status_listening: string
  live_chunk_hint: string
  live_empty: string
  live_empty_desc: string
  live_entries_label: string
  live_clear: string
  live_copy_all: string
  live_copied: string
  live_no_openai_key: string
  live_no_translate_key: string
  live_status_translating: string
  live_panel_original: string
  live_panel_translation: string
  live_words: string
  live_summarize: string
  live_summarize_again: string
  live_summarizing: string
  live_summary_title: string

  // Chat page
  chat_placeholder: string
  chat_send: string
  chat_clear: string
  chat_new_session: string
  chat_thinking: string
  chat_error_no_key: string
  chat_error_open_settings: string
  chat_attach_image: string
  chat_remove_image: string
  chat_copy: string
  chat_copied: string
  chat_voice_record: string
  chat_voice_stop: string
  chat_empty_title: string
  chat_empty_desc: string
  chat_system_prompt: string
  chat_system_prompt_placeholder: string
  chat_regenerate: string

  // Settings — AI Chat section
  settings_chat_section: string
  settings_chat_section_desc: string
  settings_chat_go_to_chat: string
  settings_chat_presets: string
  settings_chat_presets_empty: string
  settings_chat_preset_add: string
  settings_chat_preset_name: string
  settings_chat_preset_name_placeholder: string
  settings_chat_preset_content: string
  settings_chat_preset_set_default: string
  settings_chat_preset_is_default: string
  settings_chat_preset_delete: string
  settings_chat_preset_save: string
  settings_chat_preset_cancel: string
}

const en: Translations = {
  nav_translate: 'Translate with AI',
  nav_history: 'History',
  nav_settings: 'Settings',
  nav_new_chat: 'New Chat',
  nav_chat: 'Chat with AI',
  translate_placeholder: 'Enter text to translate…',
  translate_result_placeholder: 'Translation will appear here…',
  translate_btn: 'Translate',
  translate_btn_loading: 'Translating…',
  translate_clear: 'Clear',
  translate_copy: 'Copy',
  translate_copied: 'Copied!',
  translate_auto_indicator: 'Auto',
  translate_manual_indicator: 'Manual',
  translate_chars: 'chars',
  translate_limit: 'Limit exceeded',
  translate_swap: 'Swap languages',
  translate_error_no_key: 'No API key configured. Go to Settings to add one.',
  translate_error_open_settings: 'Open Settings',
  translate_phonetic: 'Phonetic',
  translate_style_label: 'Style',
  translate_style_friendly: 'Friendly',
  translate_style_neutral: 'Neutral',
  translate_style_professional: 'Professional',
  translate_style_business: 'Business',
  translate_style_slack: 'Slack',
  translate_style_polite: 'Polite',
  translate_style_technical: 'Technical',
  translate_speak: 'Read aloud',
  translate_speak_stop: 'Stop reading',
  voice_record: 'Record voice',
  voice_stop: 'Stop recording',
  voice_listening: 'Listening…',
  voice_transcribing: 'Transcribing…',
  voice_whisper_mode: 'Recording…',
  model_no_key: 'No API key',
  model_loading: 'Loading models…',
  model_load_error: 'Failed to load',
  model_refresh: 'Refresh',
  lang_auto: 'Auto Detect',
  lang_names: {
    auto: 'Auto Detect',
    vi: 'Vietnamese',
    en: 'English',
    zh: 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    ja: 'Japanese',
    ko: 'Korean',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
    th: 'Thai',
    id: 'Indonesian',
    it: 'Italian',
    nl: 'Dutch',
    pl: 'Polish',
    tr: 'Turkish',
    hi: 'Hindi',
  },
  settings_title: 'Settings',
  settings_subtitle: 'Configure your AI providers and preferences.',
  settings_security_title: 'Stored securely in OS Keychain',
  settings_security_desc: 'API keys are saved in macOS Keychain Access / Windows Credential Manager. They never leave your device.',
  settings_security_macos: 'macOS',
  settings_security_windows: 'Windows',
  settings_api_keys: 'API Keys',
  settings_configured: 'configured',
  settings_get_key: 'Get API key ↗',
  settings_key_saved: 'Verified',
  settings_key_invalid: 'Unavailable',
  settings_no_key: 'No key',
  settings_verify_save: 'Verify',
  settings_verifying: 'Verifying…',
  settings_verified: 'Verified!',
  settings_try_again: 'Try Again',
  settings_show: 'Show',
  settings_hide: 'Hide',
  settings_remove: 'Remove',
  settings_hint_verify: 'Click Verify to test your API key — if valid, it will be saved automatically to OS Keychain.',
  settings_msg_valid: '✓ Key verified & saved to OS Keychain!',
  settings_msg_rate_limited: '⚡ Rate limited, but key looks valid — saved to Keychain.',
  settings_msg_invalid: '✗ Invalid API key — please check and try again.',
  settings_msg_network: '🌐 No internet connection — cannot verify.',
  settings_prefs: 'Preferences',
  settings_auto_translate: 'Auto Translate',
  settings_auto_translate_desc: 'Translate automatically while typing',
  settings_translate_delay: 'Translate Delay',
  settings_translate_delay_desc: 'Wait after typing stops',
  settings_translate_mode: 'Translate Mode',
  settings_translate_mode_desc: 'Auto translates while typing; Manual requires button click',
  settings_mode_auto: 'Auto',
  settings_mode_manual: 'Manual',
  settings_app_language: 'App Language',
  settings_app_language_desc: 'Language for the application interface',
  settings_locale_auto: 'Follow System',
  settings_locale_auto_desc: 'Automatically use the system language',
  settings_font_size: 'Font Size',
  settings_font_size_desc: 'Adjust the text size of the application',
  settings_font_size_small: 'Small',
  settings_font_size_medium: 'Medium',
  settings_font_size_large: 'Large',
  settings_furigana: 'Phonetic Reading',
  settings_furigana_desc: 'Show phonetic guides in translations (furigana for Japanese, pinyin for Chinese, romanization for Korean, IPA for others)',
  settings_tts_section: 'Text-to-Speech',
  settings_tts_voice: 'Voice',
  settings_tts_voice_desc: 'Voice used for read-aloud (requires OpenAI API key)',
  settings_tts_voice_alloy: 'Alloy — Neutral, balanced',
  settings_tts_voice_echo: 'Echo — Deep, resonant',
  settings_tts_voice_fable: 'Fable — Warm, narrative',
  settings_tts_voice_onyx: 'Onyx — Deep, authoritative',
  settings_tts_voice_nova: 'Nova — Warm, natural (default)',
  settings_tts_voice_shimmer: 'Shimmer — Soft, gentle',
  settings_about: 'About',
  settings_about_version: 'Version 1.0.0 · Local AI Translation',
  settings_about_platform: 'Platform',
  settings_about_supports: 'Supports',
  settings_about_footer: '🔒 100% local · No server · No telemetry · API keys stay on your device',
  image_translate_title: 'Translate Image',
  image_translate_btn: 'Translate Image',
  image_translate_upload_hint: 'Drop an image here or click to browse\nJPEG, PNG, WebP — large images are auto-resized',
  image_translate_processing: 'Analyzing & translating…',
  image_translate_no_text: 'No text found in image',
  image_translate_download: 'Download',
  image_translate_result_label: 'Translated image',
  image_translate_change: 'Change image',
  image_translate_error_no_key: 'No API key configured. Go to Settings to add one.',
  history_title: 'History',
  history_empty: 'No history yet',
  history_empty_desc: 'Your translation history will appear here.',
  history_clear_all: 'Clear All',
  history_clear_confirm: 'Are you sure you want to clear all history?',
  history_delete: 'Delete',
  history_reuse: 'Use this',
  history_chars_source: 'source chars',
  history_chars_result: 'result chars',
  history_tab_translate: 'Translate with AI',
  history_tab_chat: 'Chat Sessions',
  history_chat_empty: 'No chat sessions yet',
  history_chat_empty_desc: 'Your AI chat sessions will appear here.',
  history_chat_messages: 'messages',
  history_chat_open: 'Open',
  history_chat_delete: 'Delete',
  nav_live_translate: 'Live Translate',
  live_start: 'Start',
  live_stop: 'Stop',
  live_status_listening: 'Listening…',
  live_chunk_hint: 'translating every 3 s',
  live_empty: 'Press Start to begin live translation',
  live_empty_desc: 'Speak into your microphone. Each sentence will be transcribed and translated in real time.',
  live_entries_label: 'segments',
  live_clear: 'Clear',
  live_copy_all: 'Copy All',
  live_copied: 'Copied!',
  live_no_openai_key: 'OpenAI API key required for speech recognition (Whisper).',
  live_no_translate_key: 'No translation API key configured.',
  live_status_translating: 'Translating…',
  live_panel_original: 'Original',
  live_panel_translation: 'Translation',
  live_words: 'words',
  live_summarize: 'Summarize Session',
  live_summarize_again: 'Regenerate',
  live_summarizing: 'Generating summary…',
  live_summary_title: 'Session Summary',
  chat_placeholder: 'Type a message…',
  chat_send: 'Send',
  chat_clear: 'Clear',
  chat_new_session: 'New Chat',
  chat_thinking: 'Thinking…',
  chat_error_no_key: 'No API key configured. Go to Settings to add one.',
  chat_error_open_settings: 'Open Settings',
  chat_attach_image: 'Attach image',
  chat_remove_image: 'Remove image',
  chat_copy: 'Copy',
  chat_copied: 'Copied!',
  chat_voice_record: 'Record voice',
  chat_voice_stop: 'Stop recording',
  chat_empty_title: 'Chat with AI',
  chat_empty_desc: 'Ask anything, attach images, or record your voice.',
  chat_system_prompt: 'System prompt',
  chat_system_prompt_placeholder: 'You are a helpful assistant…',
  chat_regenerate: 'Regenerate response',
  settings_chat_section: 'AI Chat',
  settings_chat_section_desc: 'Configure default system prompt and manage chat sessions.',
  settings_chat_go_to_chat: 'Open AI Chat',
  settings_chat_presets: 'System Prompt Presets',
  settings_chat_presets_empty: 'No presets yet. Add one below.',
  settings_chat_preset_add: 'Add Preset',
  settings_chat_preset_name: 'Name',
  settings_chat_preset_name_placeholder: 'e.g. Coding Assistant',
  settings_chat_preset_content: 'Prompt',
  settings_chat_preset_set_default: 'Set as default',
  settings_chat_preset_is_default: 'Default',
  settings_chat_preset_delete: 'Delete',
  settings_chat_preset_save: 'Save',
  settings_chat_preset_cancel: 'Cancel',
}

const vi: Translations = {
  nav_translate: 'Dịch với AI',
  nav_history: 'Lịch sử',
  nav_settings: 'Cài đặt',
  nav_new_chat: 'Chat mới',
  nav_chat: 'Chat với AI',
  translate_placeholder: 'Nhập văn bản cần dịch…',
  translate_result_placeholder: 'Bản dịch sẽ hiển thị ở đây…',
  translate_btn: 'Dịch',
  translate_btn_loading: 'Đang dịch…',
  translate_clear: 'Xóa',
  translate_copy: 'Sao chép',
  translate_copied: 'Đã sao chép!',
  translate_auto_indicator: 'Tự động',
  translate_manual_indicator: 'Thủ công',
  translate_chars: 'ký tự',
  translate_limit: 'Vượt giới hạn',
  translate_swap: 'Hoán đổi ngôn ngữ',
  translate_error_no_key: 'Chưa có API key. Vào Cài đặt để thêm.',
  translate_error_open_settings: 'Mở Cài đặt',
  translate_phonetic: 'Phiên âm',
  translate_style_label: 'Phong cách',
  translate_style_friendly: 'Thân thiện',
  translate_style_neutral: 'Trung tính',
  translate_style_professional: 'Chuyên nghiệp',
  translate_style_business: 'Kinh doanh',
  translate_style_slack: 'Chat công việc',
  translate_style_polite: 'Lịch sự',
  translate_style_technical: 'Kỹ thuật',
  translate_speak: 'Đọc to',
  translate_speak_stop: 'Dừng đọc',
  voice_record: 'Thu âm giọng nói',
  voice_stop: 'Dừng thu âm',
  voice_listening: 'Đang nghe…',
  voice_transcribing: 'Đang chuyển văn bản…',
  voice_whisper_mode: 'Đang thu âm…',
  model_no_key: 'Chưa có key',
  model_loading: 'Đang tải model…',
  model_load_error: 'Tải thất bại',
  model_refresh: 'Tải lại',
  lang_auto: 'Tự động nhận dạng',
  lang_names: {
    auto: 'Tự động nhận dạng',
    vi: 'Tiếng Việt',
    en: 'Tiếng Anh',
    zh: 'Tiếng Trung (Giản thể)',
    'zh-TW': 'Tiếng Trung (Phồn thể)',
    ja: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',
    fr: 'Tiếng Pháp',
    de: 'Tiếng Đức',
    es: 'Tiếng Tây Ban Nha',
    pt: 'Tiếng Bồ Đào Nha',
    ru: 'Tiếng Nga',
    ar: 'Tiếng Ả Rập',
    th: 'Tiếng Thái',
    id: 'Tiếng Indonesia',
    it: 'Tiếng Ý',
    nl: 'Tiếng Hà Lan',
    pl: 'Tiếng Ba Lan',
    tr: 'Tiếng Thổ Nhĩ Kỳ',
    hi: 'Tiếng Hindi',
  },
  settings_title: 'Cài đặt',
  settings_subtitle: 'Cấu hình nhà cung cấp AI và tùy chọn.',
  settings_security_title: 'Lưu trữ an toàn trong OS Keychain',
  settings_security_desc: 'API key được lưu trong macOS Keychain / Windows Credential Manager. Không bao giờ rời khỏi thiết bị của bạn.',
  settings_security_macos: 'macOS',
  settings_security_windows: 'Windows',
  settings_api_keys: 'API Keys',
  settings_configured: 'đã cấu hình',
  settings_get_key: 'Lấy API key ↗',
  settings_key_saved: 'Đã xác minh',
  settings_key_invalid: 'Không khả dụng',
  settings_no_key: 'Chưa có key',
  settings_verify_save: 'Xác minh',
  settings_verifying: 'Đang xác minh…',
  settings_verified: 'Đã xác minh!',
  settings_try_again: 'Thử lại',
  settings_show: 'Hiện',
  settings_hide: 'Ẩn',
  settings_remove: 'Xóa',
  settings_hint_verify: 'Nhấn Xác minh để kiểm tra API key — nếu hợp lệ, key sẽ tự động được lưu vào OS Keychain.',
  settings_msg_valid: '✓ Key hợp lệ & đã lưu vào OS Keychain!',
  settings_msg_rate_limited: '⚡ Bị giới hạn tốc độ, key có vẻ hợp lệ — đã lưu.',
  settings_msg_invalid: '✗ API key không hợp lệ — vui lòng kiểm tra lại.',
  settings_msg_network: '🌐 Không có kết nối internet — không thể xác minh.',
  settings_prefs: 'Tùy chọn',
  settings_auto_translate: 'Tự động dịch',
  settings_auto_translate_desc: 'Tự động dịch trong khi gõ',
  settings_translate_delay: 'Độ trễ dịch',
  settings_translate_delay_desc: 'Chờ sau khi ngừng gõ',
  settings_translate_mode: 'Chế độ dịch',
  settings_translate_mode_desc: 'Tự động dịch khi gõ; Thủ công yêu cầu nhấn nút',
  settings_mode_auto: 'Tự động',
  settings_mode_manual: 'Thủ công',
  settings_app_language: 'Ngôn ngữ ứng dụng',
  settings_app_language_desc: 'Ngôn ngữ giao diện ứng dụng',
  settings_locale_auto: 'Theo hệ thống',
  settings_locale_auto_desc: 'Tự động dùng ngôn ngữ hệ thống',
  settings_font_size: 'Cỡ chữ',
  settings_font_size_desc: 'Điều chỉnh kích thước chữ trong ứng dụng',
  settings_font_size_small: 'Nhỏ',
  settings_font_size_medium: 'Vừa',
  settings_font_size_large: 'Lớn',
  settings_furigana: 'Phiên Âm',
  settings_furigana_desc: 'Hiển thị phiên âm trong bản dịch (furigana cho tiếng Nhật, pinyin cho tiếng Trung, romanization cho tiếng Hàn...)',
  settings_tts_section: 'Đọc to (TTS)',
  settings_tts_voice: 'Giọng đọc',
  settings_tts_voice_desc: 'Giọng dùng khi đọc to văn bản (cần OpenAI API key)',
  settings_tts_voice_alloy: 'Alloy — Trung tính, cân bằng',
  settings_tts_voice_echo: 'Echo — Trầm, vang',
  settings_tts_voice_fable: 'Fable — Ấm áp, kể chuyện',
  settings_tts_voice_onyx: 'Onyx — Trầm, uy quyền',
  settings_tts_voice_nova: 'Nova — Ấm áp, tự nhiên (mặc định)',
  settings_tts_voice_shimmer: 'Shimmer — Nhẹ nhàng, mềm mại',
  settings_about: 'Thông tin',
  settings_about_version: 'Phiên bản 1.0.0 · Dịch thuật AI cục bộ',
  settings_about_platform: 'Nền tảng',
  settings_about_supports: 'Hỗ trợ',
  settings_about_footer: '🔒 100% cục bộ · Không có server · Không theo dõi · API key ở lại thiết bị',
  image_translate_title: 'Dịch ảnh',
  image_translate_btn: 'Dịch ảnh',
  image_translate_upload_hint: 'Kéo ảnh vào đây hoặc nhấn để chọn\nJPEG, PNG, WebP — ảnh lớn sẽ tự động thu nhỏ',
  image_translate_processing: 'Đang phân tích & dịch…',
  image_translate_no_text: 'Không tìm thấy văn bản trong ảnh',
  image_translate_download: 'Tải xuống',
  image_translate_result_label: 'Ảnh đã dịch',
  image_translate_change: 'Đổi ảnh',
  image_translate_error_no_key: 'Chưa có API key. Vào Cài đặt để thêm.',
  history_title: 'Lịch sử',
  history_empty: 'Chưa có lịch sử',
  history_empty_desc: 'Lịch sử dịch thuật sẽ xuất hiện ở đây.',
  history_clear_all: 'Xóa tất cả',
  history_clear_confirm: 'Bạn có chắc muốn xóa toàn bộ lịch sử?',
  history_delete: 'Xóa',
  history_reuse: 'Dùng lại',
  history_chars_source: 'ký tự gốc',
  history_chars_result: 'ký tự dịch',
  history_tab_translate: 'Dịch với AI',
  history_tab_chat: 'Chat với AI',
  history_chat_empty: 'Chưa có cuộc trò chuyện',
  history_chat_empty_desc: 'Lịch sử chat AI sẽ hiển thị tại đây.',
  history_chat_messages: 'tin nhắn',
  history_chat_open: 'Mở',
  history_chat_delete: 'Xóa',
  nav_live_translate: 'Dịch trực tiếp',
  live_start: 'Bắt đầu',
  live_stop: 'Dừng',
  live_status_listening: 'Đang nghe…',
  live_chunk_hint: 'dịch mỗi 3 giây',
  live_empty: 'Nhấn Bắt đầu để dịch trực tiếp',
  live_empty_desc: 'Nói vào microphone. Mỗi câu sẽ được nhận dạng và dịch gần như tức thì.',
  live_entries_label: 'đoạn',
  live_clear: 'Xóa',
  live_copy_all: 'Sao chép tất cả',
  live_copied: 'Đã sao chép!',
  live_no_openai_key: 'Cần OpenAI API key để nhận dạng giọng nói (Whisper).',
  live_no_translate_key: 'Chưa cấu hình API key để dịch.',
  live_status_translating: 'Đang dịch…',
  live_panel_original: 'Nguyên bản',
  live_panel_translation: 'Bản dịch',
  live_words: 'từ',
  live_summarize: 'Tổng hợp nội dung',
  live_summarize_again: 'Tạo lại',
  live_summarizing: 'Đang tổng hợp…',
  live_summary_title: 'Tóm tắt buổi dịch',
  chat_placeholder: 'Nhập tin nhắn…',
  chat_send: 'Gửi',
  chat_clear: 'Xóa',
  chat_new_session: 'Chat mới',
  chat_thinking: 'Đang suy nghĩ…',
  chat_error_no_key: 'Chưa có API key. Vào Cài đặt để thêm.',
  chat_error_open_settings: 'Mở Cài đặt',
  chat_attach_image: 'Đính kèm ảnh',
  chat_remove_image: 'Xóa ảnh',
  chat_copy: 'Sao chép',
  chat_copied: 'Đã sao chép!',
  chat_voice_record: 'Thu âm giọng nói',
  chat_voice_stop: 'Dừng thu âm',
  chat_empty_title: 'Chat với AI',
  chat_empty_desc: 'Hỏi bất kỳ điều gì, đính kèm ảnh, hoặc thu âm giọng nói.',
  chat_system_prompt: 'System prompt',
  chat_system_prompt_placeholder: 'Bạn là trợ lý hữu ích…',
  chat_regenerate: 'Tạo lại phản hồi',
  settings_chat_section: 'AI Chat',
  settings_chat_section_desc: 'Cấu hình system prompt mặc định và quản lý cuộc trò chuyện.',
  settings_chat_go_to_chat: 'Mở AI Chat',
  settings_chat_presets: 'System Prompt Presets',
  settings_chat_presets_empty: 'Chưa có preset. Thêm preset bên dưới.',
  settings_chat_preset_add: 'Thêm Preset',
  settings_chat_preset_name: 'Tên',
  settings_chat_preset_name_placeholder: 'VD: Trợ lý lập trình',
  settings_chat_preset_content: 'Nội dung prompt',
  settings_chat_preset_set_default: 'Đặt làm mặc định',
  settings_chat_preset_is_default: 'Mặc định',
  settings_chat_preset_delete: 'Xóa',
  settings_chat_preset_save: 'Lưu',
  settings_chat_preset_cancel: 'Hủy',
}

const ja: Translations = {
  nav_translate: 'AIで翻訳',
  nav_history: '履歴',
  nav_settings: '設定',
  nav_new_chat: '新規チャット',
  nav_chat: 'AIチャット',
  translate_placeholder: '翻訳するテキストを入力…',
  translate_result_placeholder: '翻訳結果がここに表示されます…',
  translate_btn: '翻訳',
  translate_btn_loading: '翻訳中…',
  translate_clear: 'クリア',
  translate_copy: 'コピー',
  translate_copied: 'コピーしました！',
  translate_auto_indicator: '自動',
  translate_manual_indicator: '手動',
  translate_chars: '文字',
  translate_limit: '上限超過',
  translate_swap: '言語を入れ替え',
  translate_error_no_key: 'APIキーが設定されていません。設定で追加してください。',
  translate_error_open_settings: '設定を開く',
  translate_phonetic: '読み方',
  translate_style_label: 'スタイル',
  translate_style_friendly: 'フレンドリー',
  translate_style_neutral: 'ニュートラル',
  translate_style_professional: 'プロフェッショナル',
  translate_style_business: 'ビジネス',
  translate_style_slack: 'チャット（職場）',
  translate_style_polite: '丁寧',
  translate_style_technical: '専門',
  translate_speak: '読み上げ',
  translate_speak_stop: '読み上げ停止',
  voice_record: '音声録音',
  voice_stop: '録音停止',
  voice_listening: '聞き取り中…',
  voice_transcribing: '文字起こし中…',
  voice_whisper_mode: '録音中…',
  model_no_key: 'キーなし',
  model_loading: 'モデル読み込み中…',
  model_load_error: '読み込み失敗',
  model_refresh: '更新',
  lang_auto: '自動検出',
  lang_names: {
    auto: '自動検出',
    vi: 'ベトナム語',
    en: '英語',
    zh: '中国語（簡体字）',
    'zh-TW': '中国語（繁体字）',
    ja: '日本語',
    ko: '韓国語',
    fr: 'フランス語',
    de: 'ドイツ語',
    es: 'スペイン語',
    pt: 'ポルトガル語',
    ru: 'ロシア語',
    ar: 'アラビア語',
    th: 'タイ語',
    id: 'インドネシア語',
    it: 'イタリア語',
    nl: 'オランダ語',
    pl: 'ポーランド語',
    tr: 'トルコ語',
    hi: 'ヒンディー語',
  },
  settings_title: '設定',
  settings_subtitle: 'AIプロバイダーと設定を構成します。',
  settings_security_title: 'OSキーチェーンに安全に保存',
  settings_security_desc: 'APIキーはmacOSキーチェーン / Windows資格情報マネージャーに保存されます。デバイスから外に出ることはありません。',
  settings_security_macos: 'macOS',
  settings_security_windows: 'Windows',
  settings_api_keys: 'APIキー',
  settings_configured: '設定済み',
  settings_get_key: 'APIキーを取得 ↗',
  settings_key_saved: '確認済み',
  settings_key_invalid: '利用不可',
  settings_no_key: 'キーなし',
  settings_verify_save: '確認',
  settings_verifying: '確認中…',
  settings_verified: '確認済み！',
  settings_try_again: '再試行',
  settings_show: '表示',
  settings_hide: '非表示',
  settings_remove: '削除',
  settings_hint_verify: '「確認」をクリックしてAPIキーをテスト — 有効な場合、自動的にOSキーチェーンに保存されます。',
  settings_msg_valid: '✓ キーが確認されOSキーチェーンに保存されました！',
  settings_msg_rate_limited: '⚡ レート制限中ですが、キーは有効のようです — 保存されました。',
  settings_msg_invalid: '✗ 無効なAPIキー — 再確認してください。',
  settings_msg_network: '🌐 インターネット接続なし — 確認できません。',
  settings_prefs: '環境設定',
  settings_auto_translate: '自動翻訳',
  settings_auto_translate_desc: '入力中に自動的に翻訳',
  settings_translate_delay: '翻訳遅延',
  settings_translate_delay_desc: '入力停止後の待機時間',
  settings_translate_mode: '翻訳モード',
  settings_translate_mode_desc: '自動: 入力中に翻訳 / 手動: ボタンクリックで翻訳',
  settings_mode_auto: '自動',
  settings_mode_manual: '手動',
  settings_app_language: 'アプリ言語',
  settings_app_language_desc: 'アプリケーションインターフェースの言語',
  settings_locale_auto: 'システムに従う',
  settings_locale_auto_desc: 'システム言語を自動的に使用',
  settings_font_size: '文字サイズ',
  settings_font_size_desc: 'アプリのテキストサイズを調整します',
  settings_font_size_small: '小',
  settings_font_size_medium: '中',
  settings_font_size_large: '大',
  settings_furigana: 'フォネティック（読み方）',
  settings_furigana_desc: '翻訳に読み方ガイドを表示します（日本語: ふりがな / 中国語: ピンイン / 韓国語: ローマ字）',
  settings_tts_section: '読み上げ（TTS）',
  settings_tts_voice: '音声',
  settings_tts_voice_desc: '読み上げに使用する音声（OpenAI APIキーが必要）',
  settings_tts_voice_alloy: 'Alloy — ニュートラル、バランス',
  settings_tts_voice_echo: 'Echo — 低音、響き',
  settings_tts_voice_fable: 'Fable — 温かみ、語り',
  settings_tts_voice_onyx: 'Onyx — 低音、権威的',
  settings_tts_voice_nova: 'Nova — 温かみ、自然（デフォルト）',
  settings_tts_voice_shimmer: 'Shimmer — 柔らか、穏やか',
  settings_about: 'アプリについて',
  settings_about_version: 'バージョン 1.0.0 · ローカルAI翻訳',
  settings_about_platform: 'プラットフォーム',
  settings_about_supports: '対応',
  settings_about_footer: '🔒 完全ローカル · サーバーなし · 追跡なし · APIキーはデバイスに留まる',
  image_translate_title: '画像翻訳',
  image_translate_btn: '画像を翻訳',
  image_translate_upload_hint: '画像をここにドロップ、またはクリックして選択\nJPEG, PNG, WebP — 大きな画像は自動リサイズされます',
  image_translate_processing: '解析・翻訳中…',
  image_translate_no_text: '画像にテキストが見つかりません',
  image_translate_download: 'ダウンロード',
  image_translate_result_label: '翻訳済み画像',
  image_translate_change: '画像を変更',
  image_translate_error_no_key: 'APIキーが設定されていません。設定で追加してください。',
  history_title: '履歴',
  history_empty: '履歴がありません',
  history_empty_desc: '翻訳履歴がここに表示されます。',
  history_clear_all: 'すべて削除',
  history_clear_confirm: '履歴をすべて削除しますか？',
  history_delete: '削除',
  history_reuse: '再利用',
  history_chars_source: '元の文字数',
  history_chars_result: '翻訳文字数',
  history_tab_translate: 'AIで翻訳',
  history_tab_chat: 'AIチャット',
  history_chat_empty: 'チャット履歴がありません',
  history_chat_empty_desc: 'AIチャットセッションがここに表示されます。',
  history_chat_messages: 'メッセージ',
  history_chat_open: '開く',
  history_chat_delete: '削除',
  nav_live_translate: 'ライブ翻訳',
  live_start: '開始',
  live_stop: '停止',
  live_status_listening: '聞き取り中…',
  live_chunk_hint: '3秒ごとに翻訳',
  live_empty: '開始を押してライブ翻訳を始めてください',
  live_empty_desc: 'マイクに向かって話してください。各文がリアルタイムで書き起こし・翻訳されます。',
  live_entries_label: '件',
  live_clear: 'クリア',
  live_copy_all: 'すべてコピー',
  live_copied: 'コピーしました！',
  live_no_openai_key: '音声認識（Whisper）にOpenAI APIキーが必要です。',
  live_no_translate_key: '翻訳用APIキーが設定されていません。',
  live_status_translating: '翻訳中…',
  live_panel_original: '原文',
  live_panel_translation: '翻訳',
  live_words: '語',
  live_summarize: 'セッションを要約',
  live_summarize_again: '再生成',
  live_summarizing: '要約生成中…',
  live_summary_title: 'セッション要約',
  chat_placeholder: 'メッセージを入力…',
  chat_send: '送信',
  chat_clear: 'クリア',
  chat_new_session: '新規チャット',
  chat_thinking: '考え中…',
  chat_error_no_key: 'APIキーが設定されていません。設定で追加してください。',
  chat_error_open_settings: '設定を開く',
  chat_attach_image: '画像を添付',
  chat_remove_image: '画像を削除',
  chat_copy: 'コピー',
  chat_copied: 'コピーしました！',
  chat_voice_record: '音声録音',
  chat_voice_stop: '録音停止',
  chat_empty_title: 'AIとチャット',
  chat_empty_desc: '何でも質問、画像を添付、または音声で入力できます。',
  chat_system_prompt: 'システムプロンプト',
  chat_system_prompt_placeholder: 'あなたは親切なアシスタントです…',
  chat_regenerate: '応答を再生成',
  settings_chat_section: 'AIチャット',
  settings_chat_section_desc: 'デフォルトのシステムプロンプトを設定し、チャットセッションを管理します。',
  settings_chat_go_to_chat: 'AIチャットを開く',
  settings_chat_presets: 'システムプロンプト プリセット',
  settings_chat_presets_empty: 'プリセットがありません。下に追加してください。',
  settings_chat_preset_add: 'プリセット追加',
  settings_chat_preset_name: '名前',
  settings_chat_preset_name_placeholder: '例: コーディングアシスタント',
  settings_chat_preset_content: 'プロンプト内容',
  settings_chat_preset_set_default: 'デフォルトに設定',
  settings_chat_preset_is_default: 'デフォルト',
  settings_chat_preset_delete: '削除',
  settings_chat_preset_save: '保存',
  settings_chat_preset_cancel: 'キャンセル',
}

export const TRANSLATIONS: Record<AppLocale, Translations> = { en, vi, ja }

export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  ja: '日本語',
}
