import { firstValueFrom } from 'rxjs';
import { ContractViolationError } from './contract-violation.error.js';
import { ResponseAssertInterceptor } from './response-assert.interceptor.js';
import {
  ROUTED_REQUEST,
  VALID_LIST_ENVELOPE,
  createCallHandler,
  createOpenApiExecutionContext,
} from './test/mocks/openapi.mock.js';

/**
 * The interceptor is the thin adapter around {@link assertResponseMatchesContract}:
 * it reads the route, decides whether the route is documented at all, and lets
 * the body through untouched when it is not. Those two decisions are what this
 * suite pins down; the schema assertions live in the logic spec.
 */

describe('ResponseAssertInterceptor', () => {
  const interceptor = new ResponseAssertInterceptor();

  it('passes a contract-conforming body through unchanged', async () => {
    const body = await firstValueFrom(
      interceptor.intercept(
        createOpenApiExecutionContext(),
        createCallHandler(VALID_LIST_ENVELOPE),
      ),
    );

    expect(body).toBe(VALID_LIST_ENVELOPE);
  });

  it('fails the request when a registered route breaks the contract', async () => {
    await expect(
      firstValueFrom(
        interceptor.intercept(
          createOpenApiExecutionContext(),
          createCallHandler({ data: 'not a list' }),
        ),
      ),
    ).rejects.toBeInstanceOf(ContractViolationError);
  });

  it('leaves an exempt route untouched', async () => {
    const body = { status: 'oks' };

    const result = await firstValueFrom(
      interceptor.intercept(
        createOpenApiExecutionContext({
          ...ROUTED_REQUEST,
          method: 'GET',
          url: '/healthz',
          routeOptions: { url: '/healthz' },
        }),
        createCallHandler(body),
      ),
    );

    expect(result).toEqual({ status: 'oks' });
  });

  it('leaves a plugin-served route untouched', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        createOpenApiExecutionContext({
          ...ROUTED_REQUEST,
          url: '/api/docs',
          routeOptions: { url: '/api/docs' },
        }),
        createCallHandler('<html></html>'),
      ),
    );

    expect(result).toBe('<html></html>');
  });

  it('leaves a request without a matched route untouched', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        createOpenApiExecutionContext({
          id: 'req-404',
          method: 'GET',
          url: '/api/nope',
          headers: {},
        }),
        createCallHandler({ message: 'not found' }),
      ),
    );

    expect(result).toEqual({ message: 'not found' });
  });
});
