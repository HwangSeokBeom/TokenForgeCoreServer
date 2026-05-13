import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (
      typeof exception === 'object' &&
      exception !== null &&
      'getStatus' in exception &&
      'getResponse' in exception
    ) {
      const status = (exception as HttpException).getStatus();
      const body = (exception as HttpException).getResponse();
      response.status(status).json(body);
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error',
    });
  }
}
