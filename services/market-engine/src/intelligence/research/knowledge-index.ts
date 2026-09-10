import type {KnowledgeEntity, KnowledgeEntityKind} from './types';

/**
 * SPRINT 036 — knowledge index: deterministic entity lookup by kind + key.
 */

export interface KnowledgeIndex {
  readonly byKind: Readonly<Record<KnowledgeEntityKind, Readonly<Record<string, KnowledgeEntity>>>>;
  readonly entityCount: number;
}

export function buildKnowledgeIndex(entities: readonly KnowledgeEntity[]): KnowledgeIndex {
  const byKind = {} as Record<KnowledgeEntityKind, Record<string, KnowledgeEntity>>;
  for (const entity of entities) {
    (byKind[entity.kind] ??= {})[entity.key] = entity;
  }
  return Object.freeze({byKind: Object.freeze(byKind), entityCount: entities.length});
}

export function getEntity(
  index: KnowledgeIndex, kind: KnowledgeEntityKind, key: string,
): KnowledgeEntity | null {
  return index.byKind[kind]?.[key] ?? null;
}

export function entitiesOfKind(
  index: KnowledgeIndex, kind: KnowledgeEntityKind,
): readonly KnowledgeEntity[] {
  return Object.values(index.byKind[kind] ?? {}).sort((a, b) => a.key.localeCompare(b.key));
}
