import { describe, expect, it } from "vitest";
import { z } from "zod";
import { definePlugin } from "@linkqin/plugin-sdk";
import { PluginHost } from "../index.js";

describe("PluginHost", () => {
  it("registers and lists plugins", () => {
    const host = new PluginHost();
    host.register(definePlugin({ name: "seo", version: "0.1.0", displayName: "SEO" }));
    expect(host.list()).toHaveLength(1);
    expect(host.isEnabled("seo")).toBe(false);
  });

  it("rejects duplicate registration", () => {
    const host = new PluginHost();
    host.register(definePlugin({ name: "seo", version: "0.1.0", displayName: "SEO" }));
    expect(() =>
      host.register(definePlugin({ name: "seo", version: "0.1.0", displayName: "SEO" })),
    ).toThrow();
  });

  it("validates config against schema on enable", async () => {
    const host = new PluginHost();
    host.register(
      definePlugin({
        name: "seo",
        version: "0.1.0",
        displayName: "SEO",
        configSchema: z.object({ title: z.string() }),
      }),
    );
    await expect(host.enable("seo", { title: "Hello" })).resolves.toBeUndefined();
    expect(host.isEnabled("seo")).toBe(true);
    await expect(host.enable("seo", { wrong: 1 })).rejects.toThrow();
  });

  it("dispatches events to handlers", async () => {
    const host = new PluginHost();
    const seen: string[] = [];
    host.eventBus.on("entry.published", (p) => {
      seen.push(p.entryId);
    });
    await host.eventBus.emit("entry.published", { entryId: "e1", contentTypeId: "ct" });
    expect(seen).toEqual(["e1"]);
  });

  it("shares its field registry with plugins via admin context", async () => {
    const host = new PluginHost();
    host.register(
      definePlugin({
        name: "markdown-field",
        version: "0.1.0",
        displayName: "Markdown Field",
        admin: (ctx) => {
          ctx.fields.register({ name: "markdown", label: "Markdown", validator: z.string() });
        },
      }),
    );
    await host.bootAdmin();
    // 插件注册的字段类型应进入共享注册表。
    expect(host.fields.has("markdown")).toBe(true);
    // 内置字段也应在同一注册表。
    expect(host.fields.has("text")).toBe(true);
  });
});
