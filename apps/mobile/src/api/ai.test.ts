import { aiServiceUrl, generatePlan, type GenerateRequest } from './ai';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
const mockExpoConfig: { hostUri?: string } = jest.requireMock('expo-constants').default.expoConfig;

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

describe('aiServiceUrl', () => {
  afterEach(() => {
    mockExpoConfig.hostUri = undefined;
    delete process.env.EXPO_PUBLIC_AI_SERVICE_URL;
  });

  it('uses the computer Expo Go connected to, in development', () => {
    mockExpoConfig.hostUri = '192.168.1.36:8081';
    expect(aiServiceUrl()).toBe('http://192.168.1.36:8002');
  });

  it('falls back to app.json, then the emulator address', () => {
    expect(aiServiceUrl()).toBe('http://10.0.2.2:8002');
  });

  it('lets an environment variable override everything', () => {
    mockExpoConfig.hostUri = '192.168.1.36:8081';
    process.env.EXPO_PUBLIC_AI_SERVICE_URL = 'https://ai.example.com/';
    expect(aiServiceUrl()).toBe('https://ai.example.com');
  });
});
