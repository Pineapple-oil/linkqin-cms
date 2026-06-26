import { HttpException } from "@nestjs/common";
import type { ErrorLiteralCode } from "@linkqin/shared";

/**
 * 统一业务异常构造。
 *
 * 抛出后由 GlobalExceptionFilter 接管：读取 response.code，
 * 通过 httpStatusForCode(code) 重算 HTTP 状态码（开发文档 7.2 / AI 规则 10）。
 *
 * 用法：throw apiException(ERROR_CODES.INVALID_CREDENTIALS, "用户名或密码错误");
 */
export function apiException(
  code: ErrorLiteralCode,
  message: string,
  details?: Record<string, unknown>,
  status = 400,
): HttpException {
  return new HttpException({ code, message, details }, status);
}
