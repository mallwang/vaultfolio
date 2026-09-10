import type { FeatureExportDefinition } from './feature-export-definition.js';

/**
 * An ordered collection of registered `FeatureExportDefinition`s, added to at bootstrap by each
 * domain library (one `register(definition)` call per domain). See data-model.md's
 * `FeatureExportRegistry` and contracts/export-lib.md.
 */
export class FeatureExportRegistry {
  private readonly definitions = new Map<string, FeatureExportDefinition>();

  /** Registers a feature's export definition. Throws if `featureId` is already registered. */
  register(definition: FeatureExportDefinition): void {
    if (this.definitions.has(definition.featureId)) {
      throw new Error(
        `FeatureExportRegistry: a definition for featureId "${definition.featureId}" is already registered.`,
      );
    }
    this.definitions.set(definition.featureId, definition);
  }

  getAll(): readonly FeatureExportDefinition[] {
    return Array.from(this.definitions.values());
  }

  getById(featureId: string): FeatureExportDefinition | undefined {
    return this.definitions.get(featureId);
  }
}
