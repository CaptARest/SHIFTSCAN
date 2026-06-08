bash

cat /home/claude/shiftscan/api/db.js
Output

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, ...params } = req.method === 'GET' ? req.query : req.body;

  try {
    let result;

    switch (action) {
      // ── Employees ──────────────────────────────────────────────────────────
      case 'getEmployees':
        result = await sql`SELECT * FROM employees ORDER BY name`;
        break;

      case 'addEmployee':
        result = await sql`
          INSERT INTO employees (name, phone, pin)
          VALUES (${params.name}, ${params.phone}, ${params.pin})
          RETURNING *`;
        break;

      case 'updateEmployee':
        result = await sql`
          UPDATE employees SET name=${params.name}, phone=${params.phone}, pin=${params.pin}
          WHERE id=${params.id} RETURNING *`;
        break;

      case 'deleteEmployee':
        await sql`DELETE FROM employees WHERE id=${params.id}`;
        result = [{ deleted: true }];
        break;

      case 'findByPhone':
        result = await sql`SELECT * FROM employees WHERE phone=${params.phone}`;
        break;

      // ── Schedules ──────────────────────────────────────────────────────────
      case 'getSchedules':
        result = await sql`SELECT * FROM schedules`;
        break;

      case 'getScheduleForEmployee':
        result = await sql`SELECT * FROM schedules WHERE employee_id=${params.employee_id}`;
        break;

      case 'setSchedules':
        await sql`DELETE FROM schedules WHERE employee_id=${params.employee_id}`;
        if (params.schedules && params.schedules.length > 0) {
          for (const s of params.schedules) {
            await sql`INSERT INTO schedules (employee_id, day_of_week, start_time, end_time)
                      VALUES (${params.employee_id}, ${s.day_of_week}, ${s.start_time}, ${s.end_time})`;
          }
        }
        result = await sql`SELECT * FROM schedules WHERE employee_id=${params.employee_id}`;
        break;

      // ── Punches ────────────────────────────────────────────────────────────
      case 'getPunches':
        result = await sql`
          SELECT * FROM punches
          WHERE punch_date >= ${params.start} AND punch_date <= ${params.end}
          ORDER BY clock_in DESC`;
        break;

      case 'getTodayPunch':
        result = await sql`
          SELECT * FROM punches
          WHERE employee_id=${params.employee_id} AND punch_date=${params.date}
          LIMIT 1`;
        break;

      case 'addPunch':
        result = await sql`
          INSERT INTO punches (employee_id, punch_date, clock_in, effective_in, scheduled_start, scheduled_end)
          VALUES (${params.employee_id}, ${params.punch_date}, ${params.clock_in}, ${params.effective_in},
                  ${params.scheduled_start || null}, ${params.scheduled_end || null})
          RETURNING *`;
        break;

      case 'clockOut':
        result = await sql`
          UPDATE punches SET clock_out=${params.clock_out}, effective_out=${params.effective_out}
          WHERE id=${params.id} RETURNING *`;
        break;

      case 'updatePunch':
        result = await sql`
          UPDATE punches SET effective_in=${params.effective_in}, clock_out=${params.clock_out},
          effective_out=${params.effective_out}, adjusted=true
          WHERE id=${params.id} RETURNING *`;
        break;

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(200).json({ data: result });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: err.message });
  }
}
