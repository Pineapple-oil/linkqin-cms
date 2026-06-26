import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
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
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const r = res as Record<string, unknown>;
        code = (r.code as string) ?? code;
        message = (r.message as string) ?? exception.message;
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
