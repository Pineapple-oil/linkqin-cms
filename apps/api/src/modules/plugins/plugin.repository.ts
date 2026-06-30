import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { type Database, plugins, pluginSettings } from "@linkqin/db";
import { DB_TOKEN } from "../../common/db-token.js";

/**
 * 插件数据访问：持久化 enabled 状态 + config（plugins/plugin_settings 表）。
 * 插件定义本身在内置清单（builtin.ts），DB 只存运行时状态。
 */
export const PLUGIN_REPO = Symbol("PLUGIN_REPO");

export interface PluginStateRow {
  id: string;
  name: string;
  version: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
}

export interface PluginConfigRow {
  id: string;
  pluginId: string;
  config: Record<string, unknown>;
}

export interface PluginRepository {
  /** upsert 插件元信息（清单与 DB 同步）。 */
  upsert(input: {
    name: string;
    version: string;
    displayName: string;
    description?: string | null;
  }): Promise<PluginStateRow>;
  findByName(name: string): Promise<PluginStateRow | undefined>;
  list(): Promise<PluginStateRow[]>;
  setEnabled(name: string, enabled: boolean): Promise<void>;
  getConfig(pluginId: string): Promise<Record<string, unknown>>;
  setConfig(pluginId: string, config: Record<string, unknown>): Promise<void>;
}

@Injectable()
export class DrizzlePluginRepository implements PluginRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async upsert(input: {
    name: string;
    version: string;
    displayName: string;
    description?: string | null;
  }): Promise<PluginStateRow> {
    // 先查是否存在，存在则更新元信息，否则插入。
    const [existing] = await this.db
      .select()
      .from(plugins)
      .where(eq(plugins.name, input.name))
      .limit(1);
    if (existing) {
      const [row] = await this.db
        .update(plugins)
        .set({
          version: input.version,
          displayName: input.displayName,
          description: input.description ?? null,
        })
        .where(eq(plugins.name, input.name))
        .returning();
      return toStateRow(row!);
    }
    const [row] = await this.db
      .insert(plugins)
      .values({
        name: input.name,
        version: input.version,
        displayName: input.displayName,
        description: input.description ?? null,
      })
      .returning();
    return toStateRow(row!);
  }

  async findByName(name: string): Promise<PluginStateRow | undefined> {
    const [row] = await this.db.select().from(plugins).where(eq(plugins.name, name)).limit(1);
    return row ? toStateRow(row) : undefined;
  }

  async list(): Promise<PluginStateRow[]> {
    const rows = await this.db.select().from(plugins);
    return rows.map(toStateRow);
  }

  async setEnabled(name: string, enabled: boolean): Promise<void> {
    await this.db.update(plugins).set({ enabled }).where(eq(plugins.name, name));
  }

  async getConfig(pluginId: string): Promise<Record<string, unknown>> {
    const [row] = await this.db
      .select()
      .from(pluginSettings)
      .where(eq(pluginSettings.pluginId, pluginId))
      .limit(1);
    if (!row) return {};
    return row.config && typeof row.config === "object"
      ? (row.config as Record<string, unknown>)
      : {};
  }

  async setConfig(pluginId: string, config: Record<string, unknown>): Promise<void> {
    // upsert：有则更新，无则插入。
    const [existing] = await this.db
      .select()
      .from(pluginSettings)
      .where(and(eq(pluginSettings.pluginId, pluginId)))
      .limit(1);
    if (existing) {
      await this.db
        .update(pluginSettings)
        .set({ config })
        .where(eq(pluginSettings.pluginId, pluginId));
      return;
    }
    await this.db.insert(pluginSettings).values({ pluginId, config });
  }
}

function toStateRow(row: {
  id: string;
  name: string;
  version: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
}): PluginStateRow {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    displayName: row.displayName,
    description: row.description,
    enabled: row.enabled,
  };
}
