import { generatePlan, type GenerateRequest } from './ai';

const body: GenerateRequest = {
  provider: 'openai',
  model: 'some-model',
  focusMuscles: [],
  profile: {
    goal: 'strength',
    level: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 45,
    limitations: [],
    equipmentIds: [],
  },
};

function mockFetch(impl: () => Promise<Partial<Response>>) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch;
  return global.fetch as jest.Mock;
}

describe('generatePlan', () => {
  it('sends the key in a header, never in the body', async () => {
    const fetchMock = mockFetch(async () => ({
      ok: true,
      json: async () => ({ plan: {}, warnings: [] }),
    }));
    const result = await generatePlan(body, 'secret-key-123');
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/plans\/generate$/);
    expect(init.headers['X-LLM-API-Key']).toBe('secret-key-123');
    expect(init.body).not.toContain('secret-key-123');
  });

  it('passes through service errors', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ code: 'provider_auth', message: 'The provider rejected the API key.' }),
    }));
    expect(await generatePlan(body, 'k')).toEqual({
      ok: false,
      code: 'provider_auth',
      message: 'The provider rejected the API key.',
    });
  });

  it('reports network failures in plain words', async () => {
    mockFetch(async () => {
      throw new TypeError('Network request failed');
    });
    const result = await generatePlan(body, 'k');
    expect(result).toMatchObject({ ok: false, code: 'network' });
  });
});
