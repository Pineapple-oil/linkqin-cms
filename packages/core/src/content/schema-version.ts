import type { ContentType, FieldDefinition } from "@linkqin/shared";

/**
 * Content Type 变更必须产生 schema version（开发文档 6.1）。
 * 比较 fields 是否发生结构性变化，决定是否升版本。
 */
export function fieldsSignature(fields: readonly FieldDefinition[]): string {
  return fields
    .map(
      (f) =>
        `${f.name}:${f.type}:${f.required ? "1" : "0"}:${f.unique ? "1" : "0"}:${f.localized ? "1" : "0"}`,
    )
    .join("|");
}

/** 当字段结构变化时返回新版本号，否则保持原版本。 */
export function bumpSchemaVersion(
  current: Pick<ContentType, "schemaVersion" | "fields">,
  nextFields: readonly FieldDefinition[],
): number {
  if (fieldsSignature(current.fields) !== fieldsSignature(nextFields)) {
    return current.schemaVersion + 1;
  }
  return current.schemaVersion;
}
