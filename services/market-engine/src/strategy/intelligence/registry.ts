import {StrategyDefinition, StrategyStatus} from './types';
import {STRATEGY_TEMPLATES, findTemplate} from './templates';
import {StrategyDiscoveryEngine, StrategyEngineConfig, DEFAULT_STRATEGY_ENGINE_CONFIG} from './engine';

/**
 * Deterministic Strategy Registry.
 *
 * Extends the existing strategy registry concept with registration, unregister,
 * enable/disable, lookup, compatibility, versioning and health. A disabled or
 * incompatible strategy is never selected; a stale strategy is rejected.
 */

export interface StrategyHealth {
  readonly strategyId: string;
  readonly enabled: boolean;
  readonly available: boolean;
  readonly configurationValid: boolean;
  readonly version: string;
}

export class StrategyRegistry {
  private readonly defs = new Map<string, StrategyDefinition>();
  private readonly disabled = new Set<string>();

  /** Register all canned templates, plus any provided definitions. */
  constructor(customDefinitions: readonly StrategyDefinition[] = []) {
    this.registerMany(STRATEGY_TEMPLATES);
    this.registerMany(customDefinitions);
  }

  registerMany(items: readonly StrategyDefinition[]): void {
    for (const d of items) this.register(d);
  }

  register(def: StrategyDefinition): void {
    if (!def.strategyId || !def.version) throw new Error('invalid strategy definition: missing id/version');
    this.defs.set(def.strategyId, def);
  }

  unregister(strategyId: string): void {
    this.defs.delete(strategyId);
    this.disabled.delete(strategyId);
  }

  enable(strategyId: string): void {
    this.disabled.delete(strategyId);
  }

  disable(strategyId: string): void {
    this.disabled.add(strategyId);
  }

  lookup(strategyId: string): StrategyDefinition | undefined {
    const d = this.defs.get(strategyId);
    if (!d) return undefined;
    if (this.disabled.has(strategyId)) return Object.freeze({...d, enabled: false});
    return d;
  }

  allDefinitions(): readonly StrategyDefinition[] {
    return [...this.defs.values()].map((d) => (this.disabled.has(d.strategyId) ? Object.freeze({...d, enabled: false}) : d));
  }

  /** Registry health: is the strategy present, enabled and valid? */
  health(strategyId: string): StrategyHealth {
    const d = this.defs.get(strategyId);
    const enabled = !this.disabled.has(strategyId);
    return Object.freeze({
      strategyId,
      enabled,
      available: !!d && enabled,
      configurationValid: !!d && Number.isFinite(d.limits.maxCapital) && d.limits.maxCapital > 0,
      version: d?.version ?? '',
    });
  }

  /**
   * Build a fresh, isolated discovery engine backed by this registry. Passing a
   * custom config is optional; if omitted the deterministic default is used.
   */
  engine(config: StrategyEngineConfig = DEFAULT_STRATEGY_ENGINE_CONFIG): StrategyDiscoveryEngine {
    return new StrategyDiscoveryEngine(this, config);
  }
}

export function isTemplateKnown(strategyId: string): boolean {
  return !!findTemplate(strategyId);
}
