import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { definePlugin } from "@linkqin/plugin-sdk";
import { z } from "zod";
import { PluginService } from "./plugin.service.js";
import { PluginHostService } from "./plugin.host.js";
import {
  type PluginRepository,
  type PluginStateRow,
} from "./plugin.repository.js";

// mock builtin 模块，提供测试插件（定义放在 factory 内避免 hoist 问题）。
vi.mock("./builtin.js", () => ({
  builtinPlugins: [
    definePlugin({
      name: "test-plugin",
      version: "0.1.0",
      displayName: "Test Plugin",
      configSchema: z.object({ title: z.string() }),
    }),
  ],
}));

/**
 * PluginService 单测：聚焦 enable/disable/config 校验与状态合并。
 */
function makeFakeRepo() {
  const states = new Map<string, PluginStateRow>();
  const configs = new Map<string, Record<string, unknown>>();
  let seq = 0;
  return {
    states,
    async upsert(input: { name: string; version: string; displayName: string; description?: string | null }) {
      const existing = states.get(input.name);
      if (existing) {
        existing.version = input.version;
        existing.displayName = input.displayName;
        return existing;
      }
      seq += 1;
      const row: PluginStateRow = {
        id: `p-${seq}`,
        name: input.name,
        version: input.version,
        displayName: input.displayName,
        description: input.description ?? null,
        enabled: false,
      };
      states.set(input.name, row);
      return row;
    },
    async findByName(name: string) {
      return states.get(name);
    },
    async list() {
      return [...states.values()];
    },
    async setEnabled(name: string, enabled: boolean) {
      const s = states.get(name);
      if (s) s.enabled = enabled;
    },
    async getConfig(id: string) {
      return configs.get(id) ?? {};
    },
    async setConfig(id: string, config: Record<string, unknown>) {
      configs.set(id, config);
    },
  } as unknown as PluginRepository & { states: Map<string, PluginStateRow> };
}

describe("PluginService (unit)", () => {
  let repo: ReturnType<typeof makeFakeRepo>;
  let hostService: PluginHostService;
  let service: PluginService;

  beforeEach(async () => {
    repo = makeFakeRepo();
    hostService = new PluginHostService();
    // 触发 host 注册内置插件（模拟 OnModuleInit）。
    await hostService.onModuleInit();
    service = new PluginService(repo, hostService);
  });

  afterEach(() => {
    repo.states.clear();
  });

  it("list returns builtin plugins with enabled=false initially", async () => {
    const list = await service.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("test-plugin");
    expect(list[0]!.enabled).toBe(false);
  });

  it("enable validates config and persists enabled=true", async () => {
    await repo.upsert({ name: "test-plugin", version: "0.1.0", displayName: "Test Plugin" });
    const result = await service.enable("test-plugin", { title: "Hello" });
    expect(result.enabled).toBe(true);
    expect(repo.states.get("test-plugin")!.enabled).toBe(true);
    expect(hostService.host.isEnabled("test-plugin")).toBe(true);
  });

  it("enable rejects invalid config", async () => {
    await repo.upsert({ name: "test-plugin", version: "0.1.0", displayName: "Test Plugin" });
    await expect(service.enable("test-plugin", { wrong: 1 })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("disable persists enabled=false", async () => {
    await repo.upsert({ name: "test-plugin", version: "0.1.0", displayName: "Test Plugin" });
    await service.enable("test-plugin", { title: "x" });
    await service.disable("test-plugin");
    expect(repo.states.get("test-plugin")!.enabled).toBe(false);
  });

  it("enable unknown plugin returns 404", async () => {
    await expect(service.enable("ghost")).rejects.toMatchObject({ status: 404 });
  });

  it("setConfig validates against schema", async () => {
    await repo.upsert({ name: "test-plugin", version: "0.1.0", displayName: "Test Plugin" });
    await expect(service.setConfig("test-plugin", { bad: 1 })).rejects.toMatchObject({
      status: 400,
    });
    const ok = await service.setConfig("test-plugin", { title: "T" });
    expect(ok.title).toBe("T");
  });
});
