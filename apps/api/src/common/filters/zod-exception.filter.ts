import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ZodError } from "zod";
import { ERROR_CODES, errorResponse, httpStatusForCode } from "@linkqin/shared";

/**
 * 全局异常过滤器。
 * 把所有抛出统一转换为开发文档 7.2 的失败响应格式：
 * { error: { code, message, details }, meta: { requestId } }
 *
 * 所有错误使用统一错误码（开发文档 AI 规则 10）。
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL_ERROR;
    let message = "Internal server error";
    let details: Record<string, unknown> | undefined;

    if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ERROR_CODES.VALIDATION_ERROR;
      message = "Validation failed";
      details = { issues: exception.issues };
    } else if (isHttpExceptionLike(exception)) {
      status = exception.getStatus();
      // Nest 默认异常（如 Guard 返回 false）可能没有业务 code，
      // 需按 HTTP 状态码补一个统一错误码，避免被当成 INTERNAL_ERROR 映射成 500。
      code = defaultCodeForStatus(status);
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const r = res as Record<string, unknown>;
        code = (r.code as string) ?? code;
        message = messageFromResponse(r, exception.message);
        details = r.details as Record<string, unknown> | undefined;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack ?? exception.message);
    } else {
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    // 由错误码覆盖一次状态码，保持一致。
    const resolvedStatus = code ? httpStatusForCode(code) : status;

    response.status(resolvedStatus).send(
      errorResponse(code, message, details, requestIdOf(request)),
    );
  }
}

function requestIdOf(request: unknown): string | undefined {
  const r = request as { headers?: Record<string, string> } | undefined;
  return r?.headers?.["x-request-id"];
}

interface HttpExceptionLike {
  getStatus(): number;
  getResponse(): unknown;
  message: string;
}

function isHttpExceptionLike(value: unknown): value is HttpExceptionLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { getStatus?: unknown }).getStatus === "function" &&
    typeof (value as { getResponse?: unknown }).getResponse === "function"
  );
}

function messageFromResponse(response: Record<string, unknown>, fallback: string): string {
  const message = response.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join(", ");
  return fallback;
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ERROR_CODES.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ERROR_CODES.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ERROR_CODES.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ERROR_CODES.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ERROR_CODES.CONFLICT;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}
