import type { PluginDefinition } from "@linkqin/plugin-sdk";
import {
  type BackendPluginContext,
  type MenuEntry,
  type PermissionDeclaration,
  type PluginMigrationStep,
  type PluginRoute,
  type AdminPluginContext,
} from "@linkqin/plugin-sdk";
import { FieldRegistry } from "../fields/registry.js";
import { InMemoryEventBus } from "./event-bus.js";

/**
 * 插件宿主：核心模块不得依赖具体插件，但需要为插件提供运行容器。
 * 负责：注册、生命周期编排（register/boot/enable/disable）。
 *
 * 持有共享的 FieldRegistry 实例并注入到后台上下文，
 * 使插件注册的字段类型能真正进入注册表（开发文档 8.1）。
 */
export class PluginHost {
  readonly eventBus = new InMemoryEventBus();
  /** 共享字段注册表：内置字段 + 插件字段，core 与插件共用。 */
  readonly fields = new FieldRegistry();
  private readonly definitions = new Map<string, PluginDefinition>();
  private readonly states = new Map<string, boolean>();
  readonly routes: PluginRoute[] = [];
  readonly menus: MenuEntry[] = [];
  readonly permissions: PermissionDeclaration[] = [];
  private readonly migrations = new Map<string, PluginMigrationStep[]>();

  register(definition: PluginDefinition): void {
    if (this.definitions.has(definition.name)) {
      throw new Error(`Plugin "${definition.name}" already registered`);
    }
    this.definitions.set(definition.name, definition);
    this.states.set(definition.name, false);
  }

  get(name: string): PluginDefinition | undefined {
    return this.definitions.get(name);
  }

  list(): PluginDefinition[] {
    return [...this.definitions.values()];
  }

  isEnabled(name: string): boolean {
    return this.states.get(name) ?? false;
  }

  async enable(name: string, config: unknown): Promise<void> {
    const def = this.definitions.get(name);
    if (!def) throw new Error(`Plugin "${name}" not found`);

    // 配置校验：插件配置必须有 Zod schema。
    if (def.configSchema) {
      const parsed = def.configSchema.safeParse(config);
      if (!parsed.success) {
        throw new Error(`Plugin "${name}" config invalid: ${parsed.error.message}`);
      }
    }

    const ctx = this.createBackendContext(config);
    await def.backend?.(ctx);
    this.states.set(name, true);
  }

  async disable(name: string): Promise<void> {
    if (!this.definitions.has(name)) throw new Error(`Plugin "${name}" not found`);
    this.states.set(name, false);
  }

  /**
   * 执行所有已注册插件的 admin 钩子（菜单、字段类型注册等）。
   * 遍历已注册的定义，调用方无需重复传入。
   */
  async bootAdmin(): Promise<void> {
    const ctx = this.createAdminContext();
    for (const def of this.definitions.values()) {
      await def.admin?.(ctx);
    }
  }

  private createBackendContext(config: unknown): BackendPluginContext {
    return {
      events: this.eventBus,
      routes: {
        register: (route) => this.routes.push(route),
      },
      permissions: {
        declare: (p) => this.permissions.push(p),
      },
      getConfig: () => config as never,
      logger: consoleLogger,
      migrations: {
        register: (step) => {
          const arr = this.migrations.get("__root__") ?? [];
          arr.push(step);
          this.migrations.set("__root__", arr);
        },
      },
    };
  }

  private createAdminContext(): AdminPluginContext {
    return {
      menu: {
        add: (entry) => this.menus.push(entry),
        remove: (key) => {
          const i = this.menus.findIndex((m) => m.key === key);
          if (i >= 0) this.menus.splice(i, 1);
        },
      },
      // 注入共享字段注册表：插件注册的字段类型真正生效。
      fields: this.fields,
      logger: consoleLogger,
    };
  }
}

const consoleLogger = {
  info: (m: string, meta?: Record<string, unknown>) =>
    console.info(`[plugin] ${m}`, meta ?? ""),
  warn: (m: string, meta?: Record<string, unknown>) =>
    console.warn(`[plugin] ${m}`, meta ?? ""),
  error: (m: string, meta?: Record<string, unknown>) =>
    console.error(`[plugin] ${m}`, meta ?? ""),
};
