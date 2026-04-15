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
  translate_rewrite: string
  translate_rewriting: string
  /** Tooltip on the Auto/Manual toggle when currently in auto mode */
  translate_mode_auto_title: string
  /** Tooltip on the Auto/Manual toggle when currently in manual mode */
  translate_mode_manual_title: string

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

  // Live session history
  history_tab_live: string
  history_live_empty: string
  history_live_empty_desc: string
  history_live_delete: string
  history_live_view: string
  history_live_words: string
  history_live_clear_all: string
  history_live_clear_confirm: string

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
  live_status_stt: string
  live_panel_original: string
  live_panel_translation: string
  live_words: string
  live_summarize: string
  live_summarize_again: string
  live_summarizing: string
  live_summary_title: string
  // Live — audio mode toggle
  live_audio_mode_mic: string
  live_audio_mode_mic_title: string
  live_audio_mode_system: string
  live_audio_mode_system_title: string
  // Live — screen recording permission hint
  live_screen_recording_hint: string
  live_open_system_settings: string
  // Live — subtitle controls
  live_subtitles: string
  live_subtitles_show_title: string
  live_subtitles_hide_title: string
  live_subtitle_config_title: string
  live_subtitle_text_color: string
  live_subtitle_font_size: string
  live_subtitle_bg_opacity: string
  live_subtitle_transparent: string
  live_subtitle_opaque: string
  live_subtitle_reset: string
  live_subtitle_color_white: string
  live_subtitle_color_yellow: string
  live_subtitle_color_cyan: string
  live_subtitle_color_green: string
  live_subtitle_color_orange: string
  live_subtitle_color_pink: string

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

  // Settings — Global Hotkey
  settings_hotkey_section: string
  settings_hotkey_section_desc: string
  settings_hotkey_enabled: string
  settings_hotkey_enabled_desc: string
  settings_hotkey_label: string
  settings_hotkey_desc: string
  settings_hotkey_record: string
  settings_hotkey_recording: string
  settings_hotkey_clear: string
  settings_hotkey_none: string
  settings_hotkey_provider: string
  settings_hotkey_target_lang: string
  settings_hotkey_model: string
  settings_hotkey_status_translating: string
  settings_hotkey_status_done: string
  settings_hotkey_status_error: string
  settings_hotkey_conflict: string

  // Settings — Legacy Assistant (no-extension injection)
  settings_la_section: string
  settings_la_section_desc: string
  settings_la_auto_enabled: string
  settings_la_auto_enabled_desc: string
  settings_la_inject_now: string
  settings_la_target_lang: string
  settings_la_bookmarklet_label: string
  settings_la_bookmarklet_desc: string
  settings_la_bookmarklet_copy: string
  settings_la_bookmarklet_copied: string
  settings_la_bookmarklet_drag_hint: string
  settings_la_macos_only: string

  // Settings — Chrome Extension
  settings_extension_section: string
  settings_extension_section_desc: string
  settings_extension_token_label: string
  settings_extension_token_desc: string
  settings_extension_token_copy: string
  settings_extension_token_copied: string
  settings_extension_token_regenerate: string
  settings_extension_install_hint: string
  settings_extension_port: string
  settings_extension_connected: string

  // Settings — Updates
  settings_update_section: string
  settings_update_section_desc: string
  settings_update_current_version: string
  settings_update_check: string
  settings_update_checking: string
  settings_update_available: string
  settings_update_not_available: string
  settings_update_downloading: string
  settings_update_downloaded: string
  settings_update_download: string
  settings_update_install: string
  settings_update_error: string
  settings_update_error_codesign: string

  // Settings — Legacy Browser / Bookmarklet
  settings_legacy_section: string
  settings_legacy_section_desc: string
  settings_bookmarklet_desc: string
  settings_bookmarklet_step1: string
  settings_bookmarklet_alt_hint: string
  settings_bookmarklet_reload: string
  settings_bookmarklet_reload_title: string
  settings_bookmarklet_loading: string
  settings_bookmarklet_copy: string
  settings_bookmarklet_copied: string
  settings_bookmarklet_step2: string
  settings_bookmarklet_step2_desc: string

  // Settings — Token management
  settings_token_manage: string
  settings_token_create: string
  settings_token_name_label: string
  settings_token_ttl_label: string
  settings_token_ttl_7: string
  settings_token_ttl_30: string
  settings_token_ttl_90: string
  settings_token_ttl_365: string
  settings_token_cancel: string
  settings_token_generate: string
  settings_token_reveal_body: string
  settings_token_copy: string
  settings_token_copied: string
  settings_token_expires_label: string
  settings_token_error_connect: string
  settings_token_error_load: string
  settings_token_retry: string
  settings_token_loading: string
  settings_token_empty: string
  settings_token_expired: string
  settings_token_days_warning: string
  settings_token_days_info: string
  settings_token_regenerate_title: string
  settings_token_regenerate: string
  settings_token_delete_title: string
  settings_token_copy_url_title: string
  settings_token_error_create: string
  settings_token_error_delete: string
  settings_token_error_regenerate: string
  settings_token_ipc_error: string
  settings_preset_use_prompt: string

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
