// Мини-реализация подмножества Prisma Client в памяти — только то, что используют контроллеры.
// Нужна, чтобы гонять интеграционные тесты без PostgreSQL. Транзакции сериализуются и
// откатываются (snapshot) при исключении, как настоящие.

const RELATIONS = {
  user: {},
  event: {
    ticketTypes: { model: 'ticketType', many: true, fk: 'eventId' },
    orders: { model: 'order', many: true, fk: 'eventId' },
    organizer: { model: 'user', local: 'organizerId' },
  },
  ticketType: {
    event: { model: 'event', local: 'eventId' },
    tickets: { model: 'ticket', many: true, fk: 'ticketTypeId' },
  },
  order: {
    event: { model: 'event', local: 'eventId' },
    user: { model: 'user', local: 'userId' },
    tickets: { model: 'ticket', many: true, fk: 'orderId' },
  },
  ticket: {
    order: { model: 'order', local: 'orderId' },
    ticketType: { model: 'ticketType', local: 'ticketTypeId' },
    checkIns: { model: 'checkIn', many: true, fk: 'ticketId' },
  },
  checkIn: { ticket: { model: 'ticket', local: 'ticketId' } },
};

const DEFAULTS = {
  user: () => ({ role: 'ATTENDEE', createdAt: new Date() }),
  event: () => ({ description: null, isPublished: false, paidSalesActive: false, createdAt: new Date() }),
  ticketType: () => ({ price: 0, isPaid: false }),
  order: () => ({ status: 'PENDING', createdAt: new Date() }),
  ticket: () => ({ status: 'VALID', createdAt: new Date() }),
  checkIn: () => ({ scannedBy: null, scannedAt: new Date() }),
};

const val = (v) => (v instanceof Date ? v.getTime() : v);

function createFakePrisma() {
  let tables;
  let seq;
  const reset = () => {
    tables = { user: [], event: [], ticketType: [], order: [], ticket: [], checkIn: [] };
    seq = { user: 0, event: 0, ticketType: 0, order: 0, ticket: 0, checkIn: 0 };
  };
  reset();

  const unique = { user: ['email'], ticket: ['qrCodeHash'] };

  function relatedRows(model, row, rel) {
    const r = RELATIONS[model][rel];
    if (!r) throw new Error(`fakePrisma: unknown relation ${model}.${rel}`);
    if (r.many) return tables[r.model].filter((x) => x[r.fk] === row.id);
    return tables[r.model].find((x) => x.id === row[r.local]) || null;
  }

  function matchOps(actual, cond) {
    if (cond === null || typeof cond !== 'object' || cond instanceof Date) return val(actual) === val(cond);
    return Object.entries(cond).every(([op, expected]) => {
      switch (op) {
        case 'equals': return val(actual) === val(expected);
        case 'not': return !matchOps(actual, expected);
        case 'in': return expected.map(val).includes(val(actual));
        case 'notIn': return !expected.map(val).includes(val(actual));
        case 'gte': return val(actual) >= val(expected);
        case 'gt': return val(actual) > val(expected);
        case 'lte': return val(actual) <= val(expected);
        case 'lt': return val(actual) < val(expected);
        case 'contains':
          return cond.mode === 'insensitive'
            ? String(actual).toLowerCase().includes(String(expected).toLowerCase())
            : String(actual).includes(expected);
        case 'mode': return true;
        default: throw new Error(`fakePrisma: unsupported operator ${op}`);
      }
    });
  }

  function matches(model, row, where = {}) {
    return Object.entries(where).every(([k, cond]) => {
      if (k === 'AND') return [].concat(cond).every((w) => matches(model, row, w));
      if (k === 'OR') return cond.some((w) => matches(model, row, w));
      if (RELATIONS[model][k]) {
        const rel = relatedRows(model, row, k);
        if (RELATIONS[model][k].many) return (rel || []).some((x) => matches(RELATIONS[model][k].model, x, cond));
        return !!rel && matches(RELATIONS[model][k].model, rel, cond);
      }
      return matchOps(row[k], cond);
    });
  }

  function shape(model, row, args = {}) {
    if (!row) return null;
    const build = (rel, sub) => {
      const target = RELATIONS[model][rel].model;
      const data = relatedRows(model, row, rel);
      const subArgs = sub === true ? {} : sub;
      if (RELATIONS[model][rel].many) {
        let list = data.filter((x) => matches(target, x, subArgs.where));
        list = order(list, subArgs.orderBy);
        return list.map((x) => shape(target, x, subArgs));
      }
      return shape(target, data, subArgs);
    };
    if (args.select) {
      const out = {};
      for (const [k, v] of Object.entries(args.select)) {
        if (!v) continue;
        out[k] = RELATIONS[model][k] ? build(k, v) : row[k];
      }
      return out;
    }
    const out = { ...row };
    for (const [rel, sub] of Object.entries(args.include || {})) if (sub) out[rel] = build(rel, sub);
    return out;
  }

  function order(list, orderBy) {
    if (!orderBy) return list;
    const [[k, dir]] = Object.entries(orderBy);
    return [...list].sort((a, b) => (val(a[k]) > val(b[k]) ? 1 : val(a[k]) < val(b[k]) ? -1 : 0) * (dir === 'desc' ? -1 : 1));
  }

  function applyData(model, row, data) {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && !(v instanceof Date) && 'increment' in v) row[k] += v.increment;
      else if (v && typeof v === 'object' && !(v instanceof Date) && 'decrement' in v) row[k] -= v.decrement;
      else row[k] = v;
    }
  }

  function modelApi(model) {
    const find = (where) => tables[model].filter((r) => matches(model, r, where));
    return {
      async findUnique({ where, ...args }) {
        const [[k, v]] = Object.entries(where);
        return shape(model, tables[model].find((r) => val(r[k]) === val(v)), args);
      },
      async findFirst({ where, orderBy, ...args } = {}) {
        return shape(model, order(find(where), orderBy)[0], args);
      },
      async findMany({ where, orderBy, take, ...args } = {}) {
        let list = order(find(where), orderBy);
        if (take) list = list.slice(0, take);
        return list.map((r) => shape(model, r, args));
      },
      async count({ where } = {}) { return find(where).length; },
      async create({ data, ...args }) {
        for (const f of unique[model] || []) {
          if (tables[model].some((r) => r[f] === data[f])) {
            const e = new Error(`Unique constraint failed on ${f}`);
            e.code = 'P2002';
            throw e;
          }
        }
        const { ticketTypes, ...scalar } = data;
        const row = { ...DEFAULTS[model](), ...scalar, id: ++seq[model] };
        tables[model].push(row);
        if (ticketTypes && ticketTypes.create) {
          for (const t of ticketTypes.create) {
            tables.ticketType.push({ ...DEFAULTS.ticketType(), ...t, eventId: row.id, id: ++seq.ticketType });
          }
        }
        return shape(model, row, args);
      },
      async update({ where, data, ...args }) {
        const [[k, v]] = Object.entries(where);
        const row = tables[model].find((r) => val(r[k]) === val(v));
        if (!row) throw new Error('Record to update not found');
        applyData(model, row, data);
        return shape(model, row, args);
      },
      async updateMany({ where, data }) {
        const rows = find(where);
        rows.forEach((r) => applyData(model, r, data));
        return { count: rows.length };
      },
      async deleteMany({ where } = {}) {
        const before = tables[model].length;
        tables[model] = tables[model].filter((r) => !matches(model, r, where));
        return { count: before - tables[model].length };
      },
    };
  }

  let lock = Promise.resolve();
  const client = {
    ...Object.fromEntries(Object.keys(tables).map((m) => [m, modelApi(m)])),
    $transaction(fn) {
      const run = lock.then(async () => {
        const snapshot = structuredClone({ tables, seq });
        try {
          return await fn(client);
        } catch (e) {
          tables = snapshot.tables;
          seq = snapshot.seq;
          throw e;
        }
      });
      lock = run.catch(() => {});
      return run;
    },
    $reset: reset,
    $tables: () => tables,
  };
  return client;
}

module.exports = { createFakePrisma };
