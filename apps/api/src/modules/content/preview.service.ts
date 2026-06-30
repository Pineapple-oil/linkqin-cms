import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ERROR_CODES } from "@linkqin/shared";
import { apiException } from "../../common/errors.js";
import { env } from "../../config/env.js";

/**
 * 草稿预览 token 服务（开发文档 §10）。
 *
 * 预览 API 可读取草稿 data（非 publishedData），但必须使用 preview token。
 * token 是短期 JWT，用 PREVIEW_TOKEN_SECRET 签发，payload 含 entryId。
 */
export interface PreviewPayload {
  entryId: string;
}

@Injectable()
export class PreviewService {
  constructor(private readonly jwt: JwtService) {}

  /** 为指定 entry 生成短期预览 token（有效期 1 小时）。 */
  issue(entryId: string): string {
    return this.jwt.sign(
      { entryId } satisfies PreviewPayload,
      { secret: env.previewTokenSecret, expiresIn: "1h" },
    );
  }

  /** 校验预览 token，返回 payload。失败抛 401。 */
  verify(token: string): PreviewPayload {
    try {
      return this.jwt.verify<PreviewPayload>(token, { secret: env.previewTokenSecret });
    } catch {
      throw apiException(ERROR_CODES.TOKEN_INVALID, "预览 token 无效或已过期", undefined, 401);
    }
  }
}
