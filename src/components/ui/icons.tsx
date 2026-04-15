/**
 * Backward-compatibility shim — keeps existing import paths working.
 *
 * All icon implementations now live in the `icons/` subfolder, split by
 * category for maintainability. Import from here or directly from the
 * category file if you only need a subset:
 *
 *   import { CopyIcon } from '../components/ui/icons'          // ← still works
 *   import { CopyIcon } from '../components/ui/icons/actions'  // ← also fine
 */
export * from './icons/index'
