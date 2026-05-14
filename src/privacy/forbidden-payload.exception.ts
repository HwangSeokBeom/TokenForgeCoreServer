import { HttpException, HttpStatus } from '@nestjs/common';

export class ForbiddenPayloadException extends HttpException {
  constructor(reasons: string[]) {
    super(
      {
        errorCode: 'PRIVACY_GUARD_REJECTED',
        message: 'Request payload contains data that is not privacy-safe for server sync.',
        reasons,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
