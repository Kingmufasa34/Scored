import type { DelayResult, Journey } from '../types.js';

/**
 * Abstraction over a rail-data source so the pipeline isn't bound to any one
 * provider. Realtime Trains is the default implementation; a Darwin-backed one
 * could be dropped in behind this interface without touching the pipeline.
 */
export interface RailDataProvider {
  readonly name: string;
  /** Look up the actual outcome of a booked journey leg. */
  checkJourney(journey: Journey): Promise<DelayResult>;
}
