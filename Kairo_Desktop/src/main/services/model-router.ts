import type { ModelId, RoutingContext } from '../../shared/types'
import { MODEL_ROUTING } from '../../shared/constants'

/**
 * DEC-019: Multi-Model Routing
 * - Foreground (user-visible): Pro
 * - Background (internal summaries/compression): Flash
 *
 * User can override for foreground tasks via ModelSelector.
 */
export function routeModel(context: RoutingContext, userOverride?: ModelId): ModelId {
  if (context === 'foreground' && userOverride) {
    return userOverride
  }
  return MODEL_ROUTING[context]
}
