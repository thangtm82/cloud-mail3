import BizError from '../error/biz-error';

const MAX_SIGNATURE_LENGTH = 30000;

const signatureService = {
	async ensureTable(c) {
		await c.env.db.prepare(`
			CREATE TABLE IF NOT EXISTS account_signature (
				account_id INTEGER PRIMARY KEY,
				user_id INTEGER NOT NULL,
				signature TEXT NOT NULL DEFAULT '',
				enabled INTEGER NOT NULL DEFAULT 0,
				update_time DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`).run();
	},

	async assertOwner(c, accountId, userId) {
		const account = await c.env.db.prepare(`
			SELECT account_id
			FROM account
			WHERE account_id = ? AND user_id = ? AND is_del = 0
		`).bind(accountId, userId).first();

		if (!account) {
			throw new BizError('Mailbox not found or access denied', 403);
		}
	},

	async get(c, params, userId) {
		await this.ensureTable(c);
		const accountId = Number(params.accountId);
		if (!accountId) {
			throw new BizError('Invalid mailbox');
		}

		await this.assertOwner(c, accountId, userId);
		const row = await c.env.db.prepare(`
			SELECT account_id AS accountId,
			       signature,
			       enabled AS signatureEnabled
			FROM account_signature
			WHERE account_id = ? AND user_id = ?
		`).bind(accountId, userId).first();

		return row || {
			accountId,
			signature: '',
			signatureEnabled: 0
		};
	},

	async set(c, params, userId) {
		await this.ensureTable(c);
		const accountId = Number(params.accountId);
		const signature = typeof params.signature === 'string' ? params.signature : '';
		const signatureEnabled = Number(params.signatureEnabled) ? 1 : 0;

		if (!accountId) {
			throw new BizError('Invalid mailbox');
		}
		if (signature.length > MAX_SIGNATURE_LENGTH) {
			throw new BizError('Signature is too long');
		}

		await this.assertOwner(c, accountId, userId);
		await c.env.db.prepare(`
			INSERT INTO account_signature (account_id, user_id, signature, enabled, update_time)
			VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(account_id) DO UPDATE SET
				user_id = excluded.user_id,
				signature = excluded.signature,
				enabled = excluded.enabled,
				update_time = CURRENT_TIMESTAMP
		`).bind(accountId, userId, signature, signatureEnabled).run();

		return {
			accountId,
			signature,
			signatureEnabled
		};
	}
};

export default signatureService;
