import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ComplaintsController } from './complaints.controller.js';
import { ComplaintsService } from './complaints.service.js';

// Complaints channel kept for 5 years (LEG-02; Decreto 59/2023, art. 45).
@Module({
  imports: [AuthModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
})
export class ComplaintsModule {}
