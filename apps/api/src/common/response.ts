import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ok } from "@linkqin/shared";

/**
 * 请求级上下文：Fastify 内置 request.id 贯穿日志、响应 meta、audit log
 * （开发文档 7.2 / 18）。
 */
declare module "fastify" {
  interface FastifyRequest {
    /** 别名，与文档 meta.requestId 对齐。 */
    requestId: string;
  }
}

/**
 * Fastify genReqId：从 x-request-id 头读取，缺省生成 `req_<时间>_<随机>`。
 * 传给 FastifyAdapter 的 genReqId 选项。
 *
 * 注意：NestJS FastifyAdapter 的 genReqId 收到的是底层 IncomingMessage（raw request），
 * 而非封装后的 FastifyRequest，因此这里按 raw headers 读取。
 */
export function genRequestId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const fromHeader = request.headers["x-request-id"];
  return typeof fromHeader === "string" && fromHeader.length > 0
    ? fromHeader
    : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 注册 requestId 处理：同步 request.id 到 request.requestId 别名，
 * 并回写 x-request-id 响应头。必须在路由注册前（app.init() 前）调用。
 */
export function registerRequestId(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    request.requestId = request.id;
    reply.header("x-request-id", request.id);
  });
}

/** 包装为统一成功响应（开发文档 7.2），自动带上 requestId。 */
export function okWithRequest<T>(request: FastifyRequest, data: T) {
  return ok(data, request.id);
}
