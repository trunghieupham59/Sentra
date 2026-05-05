export type AppLocale = 'en' | 'vi' | 'ja'

export interface Translations {
  // Navbar / Sidebar
  nav_translate: string
  nav_history: string
  nav_settings: string
  nav_new_chat: string
  nav_chat: string
  nav_dictionary: string
  /** Tooltip / aria-label on the sidebar collapse button */
  nav_collapse_sidebar: string
  /** Tooltip / aria-label on the sidebar expand button */
  nav_expand_sidebar: string

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
  /** Button label to dismiss / close the error banner */
  translate_error_dismiss: string
  /** Button label to retry the last failed translation */
  translate_error_retry: string
  /** Error shown when rewrite fails */
  translate_error_rewrite: string
  /** Error shown when copy to clipboard fails */
  translate_error_copy: string
  translate_phonetic: string
  /** Phonetic mode dropdown — off */
  translate_phonetic_off: string
  /** Phonetic mode dropdown — standard (furigana/romanisation) */
  translate_phonetic_standard: string
  /** Phonetic mode dropdown — full phonetic transcription */
  translate_phonetic_transcription: string
  translate_style_label: string
  translate_style_general: string
  translate_style_formal: string
  translate_style_casual: string
  translate_style_business: string
  translate_style_technical: string
  translate_style_natural: string
  translate_speak: string
  translate_speak_stop: string
  translate_rewrite: string
  translate_rewriting: string
  /** Tooltip on the Auto/Manual toggle when currently in auto mode */
  translate_mode_auto_title: string
  /** Tooltip on the Auto/Manual toggle when currently in manual mode */
  translate_mode_manual_title: string
  /** Label on the Auto/Manual toggle when in auto mode */
  translate_mode_auto: string
  /** Label on the Auto/Manual toggle when in manual mode */
  translate_mode_manual: string

  // Voice recording
  voice_record: string
  voice_stop: string
  voice_listening: string
  voice_transcribing: string
  voice_whisper_mode: string
  /** HC-NEW-05: Error message when Speech Recognition API is unavailable (network error) */
  voice_error_network: string

  // Model selector
  model_no_key: string
  model_loading: string
  model_load_error: string
  model_refresh: string

  // Markdown chart renderer
  markdown_chart_value: string
  markdown_chart_bar: string
  markdown_chart_line: string
  markdown_chart_pie: string
  markdown_chart_total: string

  // Dictionary page
  dictionary_title: string
  dictionary_subtitle: string
  dictionary_term_label: string
  dictionary_term_placeholder: string
  dictionary_context_label: string
  dictionary_context_placeholder: string
  dictionary_source_lang: string
  dictionary_target_lang: string
  dictionary_lookup: string
  dictionary_lookup_loading: string
  dictionary_empty_title: string
  dictionary_empty_desc: string
  dictionary_empty_hints: string[]
  dictionary_no_matches: string
  dictionary_result_title: string
  dictionary_pronunciation: string
  dictionary_part_of_speech: string
  dictionary_meaning: string
  dictionary_translations: string
  dictionary_translation_detail: string
  dictionary_translation_usage: string
  dictionary_translation_nuance: string
  dictionary_translation_example: string
  dictionary_translation_collocations: string
  dictionary_translation_close: string
  dictionary_selection_lookup: string
  dictionary_selection_lookup_loading: string
  dictionary_examples: string
  dictionary_notes: string
  dictionary_favorite: string
  dictionary_unfavorite: string
  dictionary_recent: string
  dictionary_favorites: string
  dictionary_no_recent: string
  dictionary_no_favorites: string
  dictionary_delete: string
  dictionary_clear_history: string
  dictionary_reuse_translate: string
  dictionary_copy: string
  dictionary_copied: string
  dictionary_error_retry: string
  dictionary_error_required: string
  dictionary_error_too_long: string
  dictionary_error_context_too_long: string
  dictionary_error_failed: string
  dictionary_error_invalid_response: string

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
  settings_cost_currency: string
  settings_cost_total: string
  // Cost tracking — overview / dashboard
  settings_cost_section_title: string
  settings_cost_section_desc: string
  settings_cost_overview_total: string
  settings_cost_overview_total_desc: string
  settings_cost_overview_requests: string
  settings_cost_overview_tokens: string
  settings_cost_overview_avg: string
  settings_cost_overview_no_data: string
  settings_cost_overview_no_data_desc: string
  settings_cost_overview_estimated: string
  settings_cost_reset_all: string
  settings_cost_reset_all_confirm: string
  settings_cost_reset_provider: string
  settings_cost_reset_provider_confirm: string
  settings_cost_feature_chat: string
  settings_cost_feature_translate: string
  settings_cost_feature_live: string
  settings_cost_feature_dictionary: string
  settings_cost_input_tokens: string
  settings_cost_output_tokens: string
  settings_cost_total_tokens: string
  settings_cost_avg_per_request: string
  settings_cost_last_used: string
  settings_cost_last_used_just_now: string
  settings_cost_last_used_minutes: string
  settings_cost_last_used_hours: string
  settings_cost_last_used_days: string
  settings_cost_per_provider: string
  settings_cost_breakdown_by_feature: string
  settings_cost_no_activity: string
  settings_cost_first_request_hint: string
  settings_local_ai_title: string
  settings_local_ai_running: string
  settings_local_ai_not_running: string
  settings_local_ai_unavailable: string
  settings_local_ai_model_waiting: string
  settings_local_ai_models_found: string
  settings_local_ai_start_runtime: string
  settings_local_ai_benchmark: string
  settings_local_ai_benchmarking: string
  settings_local_ai_tier: string
  settings_local_ai_cpu_score: string
  settings_local_ai_memory_score: string
  settings_local_ai_runtime_speed: string
  settings_local_ai_runtime_latency: string
  settings_local_ai_benchmark_duration: string
  settings_local_ai_suggested_models: string
  settings_local_ai_model_size: string
  settings_local_ai_download_hint: string
  settings_local_ai_recommended: string
  settings_local_ai_installed: string
  settings_local_ai_download: string
  settings_local_ai_install_ollama: string
  settings_local_ai_installing_ollama: string
  settings_local_ai_install_runtime_title: string
  settings_local_ai_install_runtime_desc: string
  settings_local_ai_waiting_runtime: string
  settings_local_ai_cancel_install: string
  settings_local_ai_install_cancelled: string
  settings_local_ai_manual_install_opened: string
  settings_local_ai_ollama_installed: string
  settings_local_ai_checking_runtime: string
  settings_local_ai_restart_title: string
  settings_local_ai_restart_desc: string
  settings_local_ai_restart_now: string
  settings_local_ai_restart_later: string
  settings_local_ai_install_failed: string
  settings_local_ai_need_ollama: string
  settings_local_ai_downloaded: string
  settings_local_ai_downloading_model: string
  settings_local_ai_download_progress: string
  settings_local_ai_download_failed: string
  settings_local_ai_uninstall: string
  settings_local_ai_uninstalling: string
  settings_local_ai_uninstalled: string
  settings_local_ai_uninstall_failed: string
  settings_get_key: string
  settings_key_saved: string
  settings_key_invalid: string
  settings_no_key: string
  /** HC-NEW-03: Placeholder when user has a key and hasn't started typing a new one */
  settings_key_placeholder_new: string
  /** HC-NEW-03: Placeholder when no key exists — template: "Paste your {name} API key…" */
  settings_key_placeholder_paste: string
  settings_verify_save: string
  settings_verifying: string
  settings_verified: string
  settings_try_again: string
  settings_show: string
  settings_hide: string
  settings_remove: string
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
  // Settings — Speech-to-Text section
  settings_stt_section: string
  /** Label for the "Provider" sub-header in STT section */
  settings_stt_provider_label: string
  settings_stt_provider_desc: string
  settings_stt_engine_name: string
  settings_stt_ready: string
  settings_stt_needs_key: string
  settings_stt_usage: string
  settings_stt_feature_voice: string
  settings_stt_feature_live: string
  // STT provider selector
  settings_stt_select_provider: string
  /** Auto mode option label */
  settings_stt_auto: string
  /** Auto mode description */
  settings_stt_auto_desc: string
  /** OpenAI Whisper option label */
  settings_stt_whisper: string
  /** OpenAI Whisper description */
  settings_stt_whisper_desc: string
  /** Google Cloud STT option label */
  settings_stt_google: string
  /** Google Cloud STT description */
  settings_stt_google_desc: string
  /** Note about enabling Speech API in GCP console */
  settings_stt_google_note: string
  /** Browser Web Speech API option label */
  settings_stt_webspeech: string
  /** Browser Web Speech API description */
  settings_stt_webspeech_desc: string
  /** Status badge: always available (no API key needed) */
  settings_stt_always_available: string
  /** Status badge: needs Gemini API key */
  settings_stt_needs_gemini: string
  /** Groq Whisper option label */
  settings_stt_groq: string
  /** Groq Whisper option description */
  settings_stt_groq_desc: string
  /** Status badge: needs Groq key */
  settings_stt_needs_groq: string

  settings_tts_section: string
  /** Short description of TTS provider priority order */
  settings_tts_priority_desc: string
  /** Label for the "Priority" sub-header in TTS section */
  settings_tts_priority_label: string
  settings_tts_mode: string
  settings_tts_mode_desc: string
  settings_tts_mode_free: string
  settings_tts_mode_free_desc: string
  settings_tts_mode_auto: string
  settings_tts_mode_auto_desc: string
  settings_tts_mode_premium: string
  settings_tts_mode_premium_desc: string
  settings_tts_elevenlabs_key: string
  settings_tts_elevenlabs_key_desc: string
  /** Placeholder text for ElevenLabs API key input */
  settings_tts_el_key_placeholder: string
  /** Success message after saving ElevenLabs key */
  settings_tts_el_saved: string
  /** Fallback error label when ElevenLabs save fails */
  settings_tts_el_failed: string
  /** Note about Edge TTS being free */
  settings_tts_edge_free_note: string
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

  // Image translation — model switch notice
  /** Toast title when the system auto-switched to a different model for image translation */
  image_model_switched_title: string
  /** Toast body suffix: "Using {model} — {this string}" */
  image_model_switched_body: string
  /** Template: "Using {model}" — shown before the body in the model-switch toast */
  image_model_switched_using: string

  // Image translation
  image_translate_title: string
  image_translate_btn: string
  image_translate_upload_hint: string
  image_translate_processing: string
  /** HC-10: Sub-status shown while resizing/compressing the image */
  image_translate_compress_status: string
  image_translate_no_text: string
  image_translate_download: string
  image_translate_result_label: string
  image_translate_change: string
  image_translate_error_no_key: string
  /** HC-10: Error shown when user uploads a non-image file */
  image_translate_type_error: string
  /** Fallback error when image processing fails */
  image_translate_error_failed: string

  // History page
  history_title: string
  history_total_count: string
  history_search_placeholder: string
  history_search_clear: string
  history_no_results: string
  history_no_results_desc: string
  time_just_now: string
  time_m_ago: string
  time_h_ago: string
  time_d_ago: string
  history_empty: string
  history_empty_desc: string
  history_translate_count: string
  history_live_count: string
  history_delete: string
  history_reuse: string
  history_chars_source: string
  history_chars_result: string
  history_tab_translate: string
  history_tab_chat: string
  history_chat_empty: string
  history_chat_empty_desc: string
  history_chat_messages: string
  history_chat_role_user: string
  history_chat_role_ai: string
  history_chat_open: string
  history_chat_delete: string
  history_select_all: string
  history_selected_count: string
  history_delete_selected: string

  // Live session history
  history_tab_live: string
  history_live_empty: string
  history_live_empty_desc: string
  history_live_delete: string
  history_live_view: string
  history_live_words: string

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
  // Live — speaker analysis
  live_analyze_speakers: string
  live_analyze_speakers_again: string
  live_analyzing_speakers: string
  live_speakers_title: string
  live_speakers_rename_hint: string
  // Live — audio mode toggle
  live_audio_mode_mic: string
  live_audio_mode_mic_title: string
  live_audio_mode_system: string
  live_audio_mode_system_title: string
  live_audio_mode_both: string
  live_audio_mode_both_title: string
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
  // Live — post-meeting analysis tabs
  live_post_tab_summary: string
  live_post_tab_actions: string
  live_post_tab_decisions: string
  // Live — action items
  live_action_items: string
  live_action_items_extract: string
  live_action_items_extract_again: string
  live_extracting_action_items: string
  // Live — decisions
  live_decisions: string
  live_decisions_extract: string
  live_decisions_extract_again: string
  live_extracting_decisions: string
  // Live — export
  live_export: string
  live_export_txt: string
  live_export_srt: string
  // Live — speaker rename
  live_speaker_rename_placeholder: string
  live_speaker_rename_save: string
  live_speaker_rename_cancel: string

  // Chat page
  chat_placeholder: string
  chat_send: string
  /** Tooltip / aria label on the in-progress Stop button shown while AI is generating. */
  chat_stop: string
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
  /** HC-NEW-04: Label for the "None" option in SystemPromptDropdown */
  chat_system_prompt_none: string
  /** HC-NEW-04: Description for the "None" option in SystemPromptDropdown */
  chat_system_prompt_none_desc: string
  chat_regenerate: string
  chat_download_image: string
  chat_open_image: string
  chat_image_preview: string
  chat_close_image_preview: string
  chat_image_edit_done: string

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

  /** HC-NEW-06: Label for the Chrome Extension subsection header */
  settings_chrome_extension_label: string
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
  /** Download & install card */
  settings_extension_download_title: string
  settings_extension_download_desc: string
  settings_extension_download_btn: string
  settings_extension_install_step1: string
  settings_extension_install_step2: string
  settings_extension_install_step3: string
  settings_extension_install_step4: string

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
  /** macOS only: label for downloading the unsigned DMG in-app. */
  settings_update_download_installer: string
  /** Fallback label for opening the browser to download the DMG. */
  settings_update_download_browser: string
  settings_update_install: string
  settings_update_open_installer: string
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
  /** Draggable bookmarklet link label text */
  settings_bookmarklet_label: string

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
  settings_token_reveal_title: string
  settings_token_close: string
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

  // AI Chat Quick-Ask Popup (hotkey-triggered)
  ai_chat_popup_title: string
  ai_chat_popup_placeholder: string
  ai_chat_popup_placeholder_mod_enter: string
  ai_chat_popup_followup_placeholder: string
  ai_chat_popup_empty_desc: string
  ai_chat_popup_open_in_chat: string
  ai_chat_popup_short_label: string
  ai_chat_popup_input_too_long: string
  ai_chat_popup_new_line: string
  ai_chat_popup_close: string

  // Settings — AI Chat Hotkey
  settings_chat_hotkey_section: string
  settings_chat_hotkey_section_desc: string
  settings_chat_hotkey_enabled: string
  settings_chat_hotkey_enabled_desc: string
  settings_chat_hotkey_label: string
  settings_chat_hotkey_desc: string
  settings_chat_hotkey_recording: string
  settings_chat_hotkey_clear: string
  settings_chat_hotkey_none: string
  settings_chat_hotkey_status_conflict: string

  // Settings — AI Chat section
  settings_chat_section: string
  settings_chat_section_desc: string
  settings_chat_go_to_chat: string
  settings_chat_shortcuts: string
  settings_chat_shortcuts_desc: string
  settings_chat_shortcut_send: string
  settings_chat_shortcut_send_desc: string
  settings_chat_shortcut_send_enter: string
  settings_chat_shortcut_send_mod_enter: string
  settings_chat_shortcut_new_chat: string
  settings_chat_shortcut_new_chat_desc: string
  settings_chat_shortcut_restore_default: string
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

  // Translate page — Advanced AI Config popup
  translate_ai_config_title: string

  // Settings — Web Search (Deep Research)
  settings_web_search_section: string
  settings_web_search_title: string
  settings_web_search_desc_prefix: string
  settings_web_search_desc_suffix: string

  // Settings — TTS ElevenLabs delete confirm
  settings_tts_el_delete_confirm: string

  // Settings modal close
  settings_close: string

  // Chat — Deep Research
  chat_deep_research_hint: string
  chat_deep_research_enable: string
  chat_deep_research_disable: string
  chat_deep_research_api: string

  // Chat — Deep Research pipeline (steps + statuses surfaced inside the chat thread)
  /** Phase 1 step label */
  chat_deep_research_step_analyze: string
  /** Phase 2 step label — template `{aspect}` */
  chat_deep_research_step_round1: string
  /** Phase 3 step label — template `{round}` */
  chat_deep_research_step_gap: string
  /** Phase 3b deep-dive step label — template `{aspect}` */
  chat_deep_research_step_deep: string
  /** Phase 4 step label */
  chat_deep_research_step_cross: string
  /** Phase 5 step label */
  chat_deep_research_step_synth: string
  /** Banner shown when Tavily web search is available */
  chat_deep_research_mode_realtime: string
  /** Banner shown when no Tavily key is configured */
  chat_deep_research_mode_ai_only: string
  /** Plan summary header — template `{count}` */
  chat_deep_research_will_study: string
  /** Image context line — template `{context}` */
  chat_deep_research_image_context: string
  /** Image-derived search terms line — template `{terms}` */
  chat_deep_research_image_terms: string
  /** Knowledge-base label for image context (Phase 1) */
  chat_deep_research_image_kb_label: string
  /** Gap analysis: research is sufficient */
  chat_deep_research_complete: string
  /** Gap analysis: gaps found header — template `{count}` */
  chat_deep_research_gaps_found: string
  /** Inline label prefix for deep-dive sub-aspects */
  chat_deep_research_deeper_label: string
  /** Inline message: cannot analyze aspect — template `{error}` */
  chat_deep_research_cannot_analyze: string
  /** Inline message: cannot research deep gap — template `{error}` */
  chat_deep_research_cannot_research: string
  /** Inline message: cross-reference failed (returned to UI) — template `{error}` */
  chat_deep_research_cross_failed: string
  /** Inline message: cross-reference failed (knowledge-base entry) — template `{error}` */
  chat_deep_research_cross_failed_inline: string
  /** Inline message: synthesis failed — template `{error}` */
  chat_deep_research_synth_failed: string
  /** Inline error wrapper — template `{error}` */
  chat_deep_research_error_inline: string
  /** Step-error fallback when analyze fails */
  chat_deep_research_error_analyze: string
  /** Generic single-word "error" used as fallback */
  chat_deep_research_error_generic: string
  /** Step-error fallback when gap evaluation fails */
  chat_deep_research_error_eval: string
  /** Step-error fallback when cross-reference fails */
  chat_deep_research_error_cross: string
  /** Step-error fallback when synthesis fails */
  chat_deep_research_error_synth: string
  /** Generic "Unknown error" fallback used when chat returns empty */
  chat_deep_research_error_unknown: string
  /** Web search summary block label */
  chat_deep_research_web_summary: string

  /** Service fallback used by chatService when the editChatImage IPC bridge is missing */
  chat_error_image_edit_bridge: string

  // Chat — Smart Thinking (AI auto-decides whether to web-search)
  chat_smart_thinking_enable: string
  chat_smart_thinking_disable: string
  chat_smart_thinking_hint: string
  chat_smart_thinking_badge: string

  chat_smart_thinking_searching: string
  chat_smart_thinking_step_label_prefix: string
  chat_smart_thinking_summary_title: string
  chat_smart_thinking_default_reason: string
  chat_smart_thinking_sources_title: string
  chat_smart_thinking_no_sources: string
  chat_smart_thinking_no_results: string
  chat_smart_thinking_search_error: string
  chat_smart_thinking_no_response: string
  chat_smart_thinking_unknown_error: string

  // Chat — error messages
  chat_error_failed_regenerate: string
  chat_error_unexpected: string
  chat_error_failed_response: string
  chat_error_failed_image_edit: string
  chat_error_image_edit_reload_required: string
  chat_error_invalid_key: string
  chat_error_rate_limit: string
  chat_error_network: string
  chat_error_timeout: string
  chat_error_empty_response: string
  chat_error_blocked_recitation: string
  chat_error_blocked_safety: string
  chat_error_no_image_edit: string

  // Live — audio source section label
  live_audio_source_label: string

  // Live — export file section headers
  live_export_header: string
  live_export_original_section: string
  live_export_translation_section: string
  live_export_summary_section: string
  live_export_action_items_section: string
  live_export_decisions_section: string

  // Live — subtitle on/off toggle label
  live_subtitles_on: string
  // Live — transcript section label
  live_transcript_label: string
  // Live — default speaker label
  live_speaker_default: string
  // Live — Screen Recording permission modal title
  live_screen_permission_title: string

  // Chat — MessageBubble
  chat_thinking_label: string
  /** Header label shown on the grouped research-steps panel once every step
   *  in a Deep Research run has finished, e.g. "Đã suy nghĩ". */
  chat_research_done_label: string
  /** Unit word appended after the step count in the grouped header,
   *  e.g. "bước" / "steps". The full header reads
   *  `${chat_research_done_label} · ${count} ${chat_research_steps_unit}`. */
  chat_research_steps_unit: string
  /** Suffix appended to a research-pill row when multiple steps of the same
   *  phase have been collapsed, e.g. ` · 4 khía cạnh` / ` · 4 aspects`.
   *  Template `{count}` — full row reads `${stepLabel} · {count} aspects`. */
  chat_research_aspects_suffix: string
  chat_deep_research_summarizing: string
  chat_deep_research_badge: string


  // Live — runtime error messages
  live_error_stt_failed: string
  live_error_system_audio_unavailable: string
  live_error_screen_permission_denied: string
  live_error_mic_denied: string
  /**
   * Error shown when ALL STT providers (Whisper, Gemini, Groq) are unavailable or failed.
   * The live session is stopped automatically when this occurs.
   */
  live_error_all_stt_exhausted: string
  /** Warning shown in Live Translate when the user has selected Browser Speech API
   *  (webSpeech) which is not supported in this pipeline — Whisper will be used instead. */
  live_webspeech_not_supported: string

  // STT — Groq API key (optional free fallback)
  /** Label for the Groq API key input in STT Settings */
  settings_stt_groq_key: string
  /** Description for the Groq API key input */
  settings_stt_groq_key_desc: string
  /** Placeholder text for the Groq API key input */
  settings_stt_groq_key_placeholder: string
  /** Success message after saving Groq key */
  settings_stt_groq_saved: string
  /** Error label when Groq key save fails */
  settings_stt_groq_failed: string

  // Live — active STT backend badge
  /** Label prefix for the active STT backend badge, e.g. "STT:" */
  live_stt_badge_label: string
  /** Shown in the badge when no STT key is configured */
  live_stt_backend_none: string
}
