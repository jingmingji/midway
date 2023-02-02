import {
  Configuration,
  Inject,
  JoinPoint,
  MidwayApplicationManager,
  MidwayDecoratorService,
} from '@midwayjs/core';
import { TRACE_KEY } from './decorator/tracer.decorator';
import { TraceService } from './service';
import { SpanStatusCode } from '@opentelemetry/api';

@Configuration({
  namespace: 'otel',
})
export class OtelConfiguration {
  @Inject()
  decoratorService: MidwayDecoratorService;

  @Inject()
  traceService: TraceService;

  @Inject()
  applicationManager: MidwayApplicationManager;

  async onReady() {
    this.decoratorService.registerMethodHandler(TRACE_KEY, options => {
      return {
        around: async (joinPoint: JoinPoint) => {
          // 记录开始时间
          return this.traceService.createSpan(
            options.metadata['spanName'],
            async span => {
              try {
                // 执行原方法
                const result = await joinPoint.proceed(...joinPoint.args);
                span.setStatus({
                  code: SpanStatusCode.OK,
                });
                span.end();
                // 返回执行结果
                return result;
              } catch (err) {
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                });
                span.recordException(err);
                span.end();
                throw err;
              }
            }
          );
        },
      };
    });

    const apps = this.applicationManager.getApplications(['egg', 'koa']);

    for (const app of apps) {
      Object.defineProperties((app as any).context, {
        traceId: {
          get: () => {
            return this.traceService.getTraceId();
          },
        },
      });
    }
  }
}
