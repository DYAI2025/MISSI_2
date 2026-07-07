import { PersistenceService } from './PersistenceService.js';

export class SecretStoreService {
  private static instance: SecretStoreService | null = null;
  private persistence: PersistenceService;
  private secrets: Record<string, string> = {};
  private readonly secretPath = 'secrets/providers.local.json';

  private constructor() {
    this.persistence = PersistenceService.getInstance();
  }

  public static getInstance(): SecretStoreService {
    if (!SecretStoreService.instance) {
      SecretStoreService.instance = new SecretStoreService();
    }
    return SecretStoreService.instance;
  }

  public async init(): Promise<void> {
    this.secrets = await this.persistence.readJson<Record<string, string>>(this.secretPath, {});
  }

  public getSecret(providerId: string): string {
    return this.secrets[providerId] || '';
  }

  public async setSecret(providerId: string, secret: string): Promise<void> {
    if (!providerId) return;
    this.secrets[providerId] = secret;
    await this.persistence.writeJson<Record<string, string>>(this.secretPath, this.secrets);
  }

  public async deleteSecret(providerId: string): Promise<void> {
    if (!providerId) return;
    delete this.secrets[providerId];
    await this.persistence.writeJson<Record<string, string>>(this.secretPath, this.secrets);
  }

  public getAllConfiguredProviderIds(): string[] {
    return Object.keys(this.secrets).filter(id => this.secrets[id] && this.secrets[id].length > 0);
  }
}
