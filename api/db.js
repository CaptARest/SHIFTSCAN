const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, ...params } = req.body || {};

  try {
    const client = await pool.connect();
    let rows = [];

    switch (action) {
      case 'getEmployees':
        ({ rows } = await client.query('SELECT * FROM employees ORDER BY name'));
        break;
      case 'addEmployee':
        ({ rows } = await client.query(
          'INSERT INTO employees (name, phone, pin) VALUES ($1, $2, $3) RETURNING *',
          [params.name, params.phone, params.pin]
        ));
        break;
      case 'updateEmployee':
        ({ rows } = await client.query(
          'UPDATE employees SET name=$1, phone=$2, pin=$3 WHERE id=$4 RETURNING *',
          [params.name, params.phone, params.pin, params.id]
        ));
        break;
      case 'findByPhone':
        ({ rows } = await client.query('SELECT * FROM employees WHERE phone=$1', [params.phone]));
        break;
      case 'getSchedules':
        ({ rows } = await client.query('SELECT * FROM schedules'));
        break;
      case 'getScheduleForEmployee':
        ({ rows } = await client.query('SELECT * FROM schedules WHERE employee_id=$1', [params.employee_id]));
        break;
      case 'setSchedules':
        await client.query('DELETE FROM schedules WHERE employee_id=$1', [params.employee_id]);
        for (const s of (params.schedules || [])) {
          await client.query(
            'INSERT INTO schedules (employee_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)',
            [params.employee_id, s.day_of_week, s.start_time, s.end_time]
          );
        }
        ({ rows } = await client.query('SELECT * FROM schedules WHERE employee_id=$1', [params.employee_id]));
        break;
      case 'getPunches':
        ({ rows } = await client.query(
          'SELECT * FROM punches WHERE punch_date >= $1 AND punch_date <= $2 ORDER BY clock_in DESC',
          [params.start, params.end]
        ));
        break;
      case 'getTodayPunch':
        ({ rows } = await client.query(
          'SELECT * FROM punches WHERE employee_id=$1 AND punch_date=$2 LIMIT 1',
          [params.employee_id, params.date]
        ));
        break;
      case 'addPunch':
        ({ rows } = await client.query(
          'INSERT INTO punches (employee_id, punch_date, clock_in, effective_in, scheduled_start, scheduled_end, photo_data) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
          [params.employee_id, params.punch_date, params.clock_in, params.effective_in, params.scheduled_start, params.scheduled_end, params.photo_data || null]
        ));
        break;
      case 'clockOut':
        ({ rows } = await client.query(
          'UPDATE punches SET clock_out=$1, effective_out=$2, photo_data_out=$3 WHERE id=$4 RETURNING *',
          [params.clock_out, params.effective_out, params.photo_data || null, params.id]
        ));
        break;
      case 'updatePunch':
        ({ rows } = await client.query(
          'UPDATE punches SET effective_in=$1, clock_out=$2, effective_out=$3, adjusted=true WHERE id=$4 RETURNING *',
          [params.effective_in, params.clock_out, params.effective_out, params.id]
        ));
        break;
      default:
        client.release();
        return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    client.release();
    res.status(200).json({ data: rows });
  } catch (err) {
    console.error('DB error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
