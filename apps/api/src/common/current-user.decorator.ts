import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestComTenant } from './request-with-tenant.interface';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestComTenant>();
  return request.user;
});
