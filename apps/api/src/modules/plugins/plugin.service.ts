import { Inject, Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ERROR_CODES } from "@linkqin/shared";
import type { MenuEntry, PermissionDeclaration, PluginRoute } from "@linkqin/plugin-sdk";
import { apiException } from "../../common/errors.js";
import { builtinPlugins } from "./builtin.js";
import { PluginHostService } from "./plugin.host.js";
import {
  PLUGIN_REPO,
  type PluginRepository,
  type PluginStateRow,
} from "./plugin.repository.js";

/** 对外插件形态（合并内置定义 + DB 状态）。 */
export interface PluginView {
  name: string;
  version: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  /** 插件声明的菜单项（供后台动态合并）。 */
  menus: MenuEntry[];
  /** 插件声明的权限点。 */
  permissions: PermissionDeclaration[];
  /** 插件注册的路由。 */
  routes: PluginRoute[];
  /** 是否有可配置项。 */
  hasConfigSchema: boolean;
}

/**
 * 插件管理（开发文档 §8.4 生命周期 / §15 验收）。
 *
 * - list：合并内置定义 + DB enabled 状态 + host 已注册的 menus/permissions/routes。
 * - enable：Zod 校验 config → 写 DB enabled=true → host.enable（跑 backend 钩子）。
 * - disable：写 DB enabled=false → host.disable。
 * - boot（OnModuleInit）：同步清单到 DB + 对已启用插件跑 backend。
 */
@Injectable()
export class PluginService implements OnModuleInit {
  private readonly logger = new Logger("PluginService");

  constructor(
    @Inject(PLUGIN_REPO) private readonly repo: PluginRepository,
    private readonly hostService: PluginHostService,
  ) {}

  get host() {
    return this.hostService.host;
  }

  async onModuleInit(): Promise<void> {
    // 同步内置清单到 DB，并 boot 已启用插件的后端。
    for (const def of builtinPlugins) {
      const state = await this.repo.upsert({
        name: def.name,
        version: def.version,
        displayName: def.displayName,
        description: def.description ?? null,
      });
      if (state.enabled) {
        await this.bootPlugin(def.name, await this.repo.getConfig(state.id));
      }
    }
  }

  async list(): Promise<PluginView[]> {
    const states = await this.repo.list();
    return builtinPlugins.map((def) => {
      const state = states.find((s) => s.name === def.name);
      return {
        name: def.name,
        version: def.version,
        displayName: def.displayName,
        description: def.description ?? null,
        enabled: state?.enabled ?? false,
        menus: this.collectMenus(def.name),
        permissions: this.collectPermissions(def.name),
        routes: this.collectRoutes(def.name),
        hasConfigSchema: Boolean(def.configSchema),
      };
    });
  }

  async enable(name: string, config?: Record<string, unknown>): Promise<PluginView> {
    const def = this.requireDefinition(name);
    const state = await this.requireState(name);

    // 校验 config（插件配置必须有 Zod schema，开发文档 §8.5）。
    const effectiveConfig = config ?? (await this.repo.getConfig(state.id));
    if (def.configSchema) {
      const parsed = def.configSchema.safeParse(effectiveConfig);
      if (!parsed.success) {
        throw apiException(
          ERROR_CODES.PLUGIN_CONFIG_INVALID,
          `插件 "${name}" 配置校验失败`,
          { issues: parsed.error.issues },
          400,
        );
      }
    }

    await this.repo.setEnabled(name, true);
    await this.repo.setConfig(state.id, effectiveConfig);
    await this.bootPlugin(name, effectiveConfig);
    return (await this.list()).find((p) => p.name === name)!;
  }

  async disable(name: string): Promise<PluginView> {
    await this.requireState(name);
    await this.repo.setEnabled(name, false);
    this.host.disable(name);
    return (await this.list()).find((p) => p.name === name)!;
  }

  async getConfig(name: string): Promise<Record<string, unknown>> {
    const state = await this.requireState(name);
    return this.repo.getConfig(state.id);
  }

  async setConfig(
    name: string,
    config: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const def = this.requireDefinition(name);
    if (def.configSchema) {
      const parsed = def.configSchema.safeParse(config);
      if (!parsed.success) {
        throw apiException(
          ERROR_CODES.PLUGIN_CONFIG_INVALID,
          `插件 "${name}" 配置校验失败`,
          { issues: parsed.error.issues },
          400,
        );
      }
    }
    const state = await this.requireState(name);
    await this.repo.setConfig(state.id, config);
    return config;
  }

  // ---- 内部 ----

  /** 启用插件的后端钩子（try/catch，失败不破坏核心）。 */
  private async bootPlugin(name: string, config: Record<string, unknown>): Promise<void> {
    try {
      await this.host.enable(name, config);
    } catch (err) {
      this.logger.error(`Plugin "${name}" boot failed: ${String(err)}`);
    }
  }

  private requireDefinition(name: string) {
    const def = builtinPlugins.find((d) => d.name === name);
    if (!def) {
      throw apiException(ERROR_CODES.PLUGIN_NOT_FOUND, `插件 "${name}" 不存在`, undefined, 404);
    }
    return def;
  }

  private async requireState(name: string): Promise<PluginStateRow> {
    const state = await this.repo.findByName(name);
    if (!state) {
      throw apiException(ERROR_CODES.PLUGIN_NOT_FOUND, `插件 "${name}" 不存在`, undefined, 404);
    }
    return state;
  }

  /** 收集某插件的菜单（host.menus 是扁平数组，按 key 前缀归属不可靠；
   *  MVP 简化：所有插件菜单统一返回，由前端去重/展示）。
   *  这里按插件名标记归属（key 以插件名为前缀约定）。 */
  private collectMenus(name: string): MenuEntry[] {
    return this.host.menus.filter((m) => m.key.startsWith(`${name}.`));
  }

  private collectPermissions(name: string): PermissionDeclaration[] {
    // 权限无插件归属标记，MVP 返回全部（插件数量少）。
    void name;
    return this.host.permissions;
  }

  private collectRoutes(name: string): PluginRoute[] {
    // 路由无插件归属标记，MVP 返回空数组（Phase 6 完善）。
    void name;
    return this.host.routes;
  }
}
