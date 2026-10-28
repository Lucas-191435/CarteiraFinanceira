import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: keyof any, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // console.log('token', request.headers.authorization);
    const user = request.user;
    // console.log('GetUser decorator called with data:', user, user[data]);
    return data ? user[data] : user;
  },
);
