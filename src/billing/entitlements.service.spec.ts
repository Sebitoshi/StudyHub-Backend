import { EntitlementsService, usageDayKey } from './entitlements.service';

function buildService(subscription: any, usage: any = null) {
  const prisma: any = {
    subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
    aiDailyUsage: {
      findUnique: jest.fn().mockResolvedValue(usage),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
  };
  return { service: new EntitlementsService(prisma), prisma };
}

function activeSubscription(overrides: Record<string, any> = {}) {
  return {
    userId: 1,
    planCode: 'PREMIUM',
    status: 'AUTHORIZED',
    provider: 'mercadopago',
    currentPeriodEnd: new Date(Date.now() + 86_400_000),
    cancelledAt: null,
    initPoint: null,
    ...overrides,
  };
}

describe('EntitlementsService', () => {
  it('usa el plan gratis sin suscripción', async () => {
    const { service } = buildService(null);
    const account = await service.getAccount(1);
    expect(account.planCode).toBe('FREE');
    expect(account.premium).toBe(false);
    expect(account.dailyCredits).toBe(25);
    expect(account.remaining).toBe(25);
  });

  it('bloquea max/maxpro e imágenes sin Premium', async () => {
    const { service } = buildService(null);
    await expect(service.assertChatAccess(1, { depth: 'max' })).rejects.toMatchObject({
      status: 402,
    });
    await expect(
      service.assertChatAccess(1, { premiumOnly: 'image' }),
    ).rejects.toMatchObject({ status: 402 });
  });

  it('bloquea al agotar los créditos diarios', async () => {
    const { service } = buildService(null, { messages: 25, premiumUses: 0 });
    await expect(service.assertChatAccess(1, { depth: 'auto' })).rejects.toMatchObject({
      status: 402,
    });
  });

  it('da créditos ilimitados y acceso a maxpro con Premium activo', async () => {
    const { service } = buildService(activeSubscription(), { messages: 500, premiumUses: 3 });
    const account = await service.getAccount(1);
    expect(account.premium).toBe(true);
    expect(account.dailyCredits).toBeNull();
    await expect(
      service.assertChatAccess(1, { depth: 'maxpro', premiumOnly: 'document' }),
    ).resolves.toMatchObject({ premium: true });
  });

  it('mantiene Premium hasta el fin del periodo si se canceló', async () => {
    const { service } = buildService(activeSubscription({ status: 'CANCELLED' }));
    expect((await service.getAccount(1)).premium).toBe(true);
  });

  it('vuelve a gratis cuando el periodo ya venció', async () => {
    const { service } = buildService(
      activeSubscription({ currentPeriodEnd: new Date(Date.now() - 1000) }),
    );
    expect((await service.getAccount(1)).premium).toBe(false);
  });

  it('no rompe el chat si la migración no está aplicada', async () => {
    const prisma: any = {
      subscription: { findUnique: jest.fn().mockRejectedValue({ code: 'P2021' }) },
      aiDailyUsage: {
        findUnique: jest.fn().mockRejectedValue({ code: 'P2021' }),
        upsert: jest.fn().mockRejectedValue({ code: 'P2021' }),
      },
    };
    const service = new EntitlementsService(prisma);

    const account = await service.getAccount(1);
    expect(account).toMatchObject({ planCode: 'FREE', premium: false, remaining: 25 });
    await expect(service.assertChatAccess(1, { depth: 'auto' })).resolves.toMatchObject({
      planCode: 'FREE',
    });
    await expect(service.recordChatUsage(1, { depth: 'auto' })).resolves.toBeUndefined();
  });

  it('registra el consumo en el día de Bogotá e incrementa usos premium', async () => {
    const { service, prisma } = buildService(null);
    await service.recordChatUsage(7, { depth: 'maxpro' });
    expect(prisma.aiDailyUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_day: { userId: 7, day: usageDayKey() } },
        create: expect.objectContaining({ messages: 1, premiumUses: 1 }),
        update: expect.objectContaining({ messages: { increment: 1 } }),
      }),
    );
  });
});
