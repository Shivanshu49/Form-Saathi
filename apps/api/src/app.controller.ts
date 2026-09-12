import { Controller, Get } from '@nestjs/common';
import { healthResponseSchema, type HealthResponse } from '@form-saathi/contracts';

@Controller()
export class AppController {
  @Get('health')
  getHealth(): HealthResponse {
    return healthResponseSchema.parse({ status: 'ok', service: 'form-saathi-api' });
  }
}
