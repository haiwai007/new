import { handleApi } from "../../artifacts/caishen-studio/server/handler";
import type { CmsEnv } from "../../artifacts/caishen-studio/server/types";
export const onRequest = (context: { request: Request; env: CmsEnv }) =>
  handleApi(context.request, context.env);
