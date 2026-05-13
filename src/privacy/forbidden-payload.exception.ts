import { HttpException, HttpStatus } from '@nestjs/common';

export class ForbiddenPayloadException extends HttpException {
  constructor(paths: string[]) {
    super(
      {
        errorCode: 'FORBIDDEN_PAYLOAD',
        message: 'Request payload contains forbidden or non-sync-safe fields',
        fields: paths,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
