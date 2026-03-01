import type { ModelId, RoutingContext } from '../../shared/types'
import { MODEL_ROUTING, normalizeModelId } from '../../shared/constants'

/**
 * DEC-019: Multi-Model Routing
 * - Foreground (user-visible): low-friction default model
 * - Background (internal summaries/compression): lightweight flash fallback
 *
 * User can override for foreground tasks via ModelSelector.
 * Patch K: userOverride normalized to handle legacy model IDs from DB/settings.
 */
export function routeModel(context: RoutingContext, userOverride?: ModelId): ModelId {
  if (context === 'foreground' && userOverride) {
    return normalizeModelId(userOverride)
  }
  return MODEL_ROUTING[context]
}
