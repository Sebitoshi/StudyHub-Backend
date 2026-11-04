import { EntitlementsService, usageDayKey } from './entitlements.service';

/** Prisma simulado: el upsert actualiza el consumo igual que la base real. */
function buildService(subscription: any, usage: any = null) {
  const state = {
    messages: usage?.messages ?? 0,
    premiumUses: usage?.premiumUses ?? 0,
  };
  const prisma: any = {
    subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
    aiDailyUsage: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...state })),
      upsert: jest.fn().mockImplementation(async (args: any) => {
        const { create, update } = args;
        if (update?.messages?.increment) {
          state.messages += update.messages.increment;
        } else if (create) {
          state.messages = create.messages ?? state.messages;
        }
        if (update?.premiumUses?.increment) {
          state.premiumUses += update.premiumUses.increment;
        } else if (create) {
          state.premiumUses = create.premiumUses ?? state.premiumUses;
        }
      }),
    },
  };
  return { service: new EntitlementsService(prisma), prisma, state };
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
  it('usa el plan gratis sin suscripción: 50 mensajes y 25 usos premium', async () => {
    const { service } = buildService(null);
    const account = await service.getAccount(1);
    expect(account).toMatchObject({
      planCode: 'FREE',
      premium: false,
      dailyCredits: 50,
      premiumDailyUses: 25,
      chatUsed: 0,
      premiumUsed: 0,
    });
  });

  it('bloquea los modos Max y Max Pro sin Premium', async () => {
    const { service } = buildService(null);
    await expect(service.assertChatAccess(1, { depth: 'max' })).rejects.toMatchObject({
      status: 402,
      response: { code: 'PREMIUM_REQUIRED' },
    });
    await expect(service.assertChatAccess(1, { depth: 'maxpro' })).rejects.toMatchObject({
      status: 402,
    });
  });

  it('permite imágenes y PDF en el plan gratis hasta 25 usos', async () => {
    const { service } = buildService(null, { messages: 3, premiumUses: 24 });
    await expect(
      service.assertChatAccess(1, { premiumOnly: 'image' }),
    ).resolves.toMatchObject({ planCode: 'FREE' });

    const exhausted = buildService(null, { messages: 3, premiumUses: 25 });
    await expect(
      exhausted.service.assertChatAccess(1, { premiumOnly: 'document' }),
    ).rejects.toMatchObject({
      status: 402,
      response: { code: 'PREMIUM_DAILY_LIMIT_REACHED' },
    });
  });

  it('bloquea al agotar los 50 mensajes diarios de chat', async () => {
    const { service } = buildService(null, { messages: 50, premiumUses: 0 });
    await expect(service.assertChatAccess(1, { depth: 'auto' })).rejects.toMatchObject({
      status: 402,
      response: { code: 'AI_DAILY_LIMIT_REACHED' },
    });
  });

  it('deja pasar al mensaje 50 y bloquea el 51', async () => {
    const { service } = buildService(null, { messages: 49, premiumUses: 0 });
    await expect(service.assertChatAccess(1, { depth: 'auto' })).resolves.toMatchObject({
      chatUsed: 49,
    });
    await service.recordChatUsage(1, { depth: 'auto' });
    await expect(service.assertChatAccess(1, { depth: 'auto' })).rejects.toMatchObject({
      status: 402,
      response: { chatUsed: 50 },
    });
  });

  it('da créditos ilimitados y acceso a maxpro con Premium activo', async () => {
    const { service, state } = buildService(activeSubscription(), {
      messages: 5000,
      premiumUses: 3000,
    });
    const account = await service.getAccount(1);
    expect(account).toMatchObject({
      planCode: 'PREMIUM',
      premium: true,
      dailyCredits: -1,
      premiumDailyUses: -1,
      chatUsed: 5000,
      premiumUsed: 3000,
    });

    await service.recordChatUsage(1, { depth: 'maxpro', premiumOnly: 'document' });
    expect(state).toMatchObject({ messages: 5001, premiumUses: 3001 });

    const refreshed = await service.getAccount(1);
    expect(refreshed.chatUsed).toBe(5001);
    expect(refreshed.premiumUsed).toBe(3001);
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
    expect(account).toMatchObject({
      planCode: 'FREE',
      premium: false,
      dailyCredits: 50,
      premiumDailyUses: 25,
      chatUsed: 0,
      premiumUsed: 0,
    });
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
        update: expect.objectContaining({
          messages: { increment: 1 },
          premiumUses: { increment: 1 },
        }),
      }),
    );
  });
});
