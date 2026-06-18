const DAILY_LIMIT = Number(process.env.WHATSAPP_DAILY_LIMIT || 10);

const usageByPhone = new Map();

function getUtcDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function checkAndConsumePhoneQuota(phone, now = new Date()) {
    const dateKey = getUtcDateKey(now);
    const existing = usageByPhone.get(phone);

    if (!existing || existing.dateKey !== dateKey) {
        usageByPhone.set(phone, { dateKey, count: 1 });
        return { allowed: true, remaining: Math.max(DAILY_LIMIT - 1, 0), limit: DAILY_LIMIT };
    }

    if (existing.count >= DAILY_LIMIT) {
        return { allowed: false, remaining: 0, limit: DAILY_LIMIT };
    }

    existing.count += 1;
    usageByPhone.set(phone, existing);
    return { allowed: true, remaining: DAILY_LIMIT - existing.count, limit: DAILY_LIMIT };
}

module.exports = { checkAndConsumePhoneQuota };
