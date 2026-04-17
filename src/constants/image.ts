/**
 * Image processing constants — shared across ImageTranslator and ChatPage.
 *
 * HC-09: Previously MAX_IMAGE_SIZE (ChatPage) and MAX_DIMENSION (ImageTranslator)
 * were two separate names/values for the same concept, causing confusion.
 * This file provides the canonical definitions for all image-related limits.
 */

/** Maximum dimension (width or height) for images attached to chat messages.
 *  Kept smaller than translate images to reduce token cost in chat context. */
export const MAX_CHAT_IMAGE_DIMENSION = 1_200

/** Maximum dimension (width or height) for images sent to image-translate.
 *  Slightly larger than chat to preserve OCR/text detail in image translation. */
export const MAX_TRANSLATE_IMAGE_DIMENSION = 1_500

/** JPEG quality factor (0.0–1.0) for image compression before upload.
 *  0.85 gives a good balance between file size and visual fidelity. */
export const IMAGE_JPEG_QUALITY = 0.85

/** Maximum compressed image size in bytes before attempting quality reduction.
 *  ~900 KB keeps base64-encoded payloads well within API limits. */
export const MAX_IMAGE_BYTES = 900_000

/**
 * Accepted MIME types string for <input type="file" accept="..."> on image pickers.
 * Used in TranslatePage and any other file-input that accepts images.
 */
export const ACCEPTED_IMAGE_MIME_TYPES = 'image/jpeg,image/png,image/webp,image/gif'
