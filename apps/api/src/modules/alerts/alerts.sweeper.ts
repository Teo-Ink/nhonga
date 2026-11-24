import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.schema.js';
import { AlertsService } from './alerts.service.js';

/**
 * Periodically runs every saved search and delivers alerts for new matches.
 * Disabled by default (ALERTS_SWEEP_MINUTES=0) so the demo stays quiet; set a
 * positive interval to turn the alert loop on. The timer is unref'd so it never
 * holds the process open, like the checkout sweeper.
 */
@Injectable()
export class AlertsSweeper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('AlertsSweeper');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly alerts: AlertsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onApplicationBootstrap(): void {
    const minutes = this.config.get('alertsSweepMinutes', { infer: true });
    if (!minutes || minutes <= 0) return;
    const ms = minutes * 60_000;
    this.log.log(`saved-search alert sweep every ${minutes} min`);
    this.timer = setInterval(() => void this.sweep(), ms);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async sweep(): Promise<void> {
    try {
      const results = await this.alerts.run();
      const delivered = results.filter((r) => r.newCount > 0);
      if (delivered.length > 0) {
        const push = delivered.reduce((n, r) => n + r.push, 0);
        this.log.log(
          `swept ${results.length} saved search(es): ${delivered.length} alerted (${push} push)`,
        );
      }
    } catch (e) {
      this.log.warn(`sweep failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
