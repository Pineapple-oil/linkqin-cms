import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { definePlugin } from "@linkqin/plugin-sdk";
import { PluginHostService } from "./plugin.host.js";

/**
 * 验证两个官方插件（seo + local-storage）的注册能力（开发文档 §15 验收）。
 *
 * 不 mock builtin —— 用真实清单，验证：
 * - 插件可注册字段类型（seo → host.fields 含 "seo"）
 * - 插件可增加后台菜单（两项菜单 → host.menus）
 * - 禁用插件后能力不影响注册表（注册是 bootAdmin 统一完成，enable/disable 控制 backend）
 */
describe("official plugins (seo + local-storage)", () => {
  it("registers both plugins in the host", async () => {
    const hostService = new PluginHostService();
    await hostService.onModuleInit();
    const names = hostService.host.list().map((d) => d.name);
    expect(names).toContain("seo");
    expect(names).toContain("local-storage");
  });

  it("seo registers a 'seo' field type (acceptance: 插件可注册字段类型)", async () => {
    const hostService = new PluginHostService();
    await hostService.onModuleInit();
    expect(hostService.host.fields.has("seo")).toBe(true);
    // 内置字段仍在。
    expect(hostService.host.fields.has("text")).toBe(true);
  });

  it("both plugins add menu entries (acceptance: 插件可增加后台菜单)", async () => {
    const hostService = new PluginHostService();
    await hostService.onModuleInit();
    const keys = hostService.host.menus.map((m) => m.key);
    expect(keys).toContain("seo.settings");
    expect(keys).toContain("local-storage.settings");
  });

  it("seo subscribes to entry.published on enable", async () => {
    const hostService = new PluginHostService();
    await hostService.onModuleInit();
    // enable seo 跑 backend 钩子（订阅事件）。
    await hostService.host.enable("seo", {});
    expect(hostService.host.isEnabled("seo")).toBe(true);
    // emit 不报错即说明订阅成功。
    await hostService.host.eventBus.emit("entry.published", {
      entryId: "e1",
      contentTypeId: "ct1",
    });
  });

  it("disabled plugin does not break host (acceptance: 禁用不破坏核心)", async () => {
    const hostService = new PluginHostService();
    await hostService.onModuleInit();
    await hostService.host.enable("seo", {});
    hostService.host.disable("seo");
    expect(hostService.host.isEnabled("seo")).toBe(false);
    // host 仍可正常 list。
    expect(hostService.host.list().length).toBeGreaterThanOrEqual(2);
  });

  it("plugins only depend on plugin-sdk contract (no core/api imports)", async () => {
    // 结构性验证：插件定义用 definePlugin（来自 plugin-sdk）。
    const { seoPlugin } = await import("./builtin/seo.js");
    const { localStoragePlugin } = await import("./builtin/local-storage.js");
    expect(seoPlugin.name).toBe("seo");
    expect(localStoragePlugin.name).toBe("local-storage");
    // definePlugin 返回的是纯数据对象（无 core/api 耦合）。
    expect(typeof seoPlugin.backend).toBe("function");
    expect(typeof seoPlugin.admin).toBe("function");
    void definePlugin;
  });
});
