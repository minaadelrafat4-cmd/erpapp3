import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// admin-sync-employee-role
//
// WHY THIS FUNCTION EXISTS
// -------------------------
// Migration 0015 (role_security_hardening) added `trg_prevent_role_self_escalation`
// on `profiles`, which RAISES on any client-side (non service_role) UPDATE that
// touches `role`, `status` or `must_change_password`. That trigger is correct and
// must stay in place — it is what stops a compromised admin session from writing
// its own role directly. But it also means the browser can never again do:
//
//   supabase.from('profiles').update({ role }).eq('id', someId)
//
// Previously the Admin Panel tried exactly that from AdminEmployees.tsx, which is
// why role edits appeared to save (employee_roles + the toast succeeded) while the
// employee's actual profiles.role — the field is_staff(), current_staff_rank() and
// the has_permission() admin bypass all key off — silently stayed on the old value.
// This function is the "employee management system" the trigger's error message
// refers to: it runs with the service role (exempted from the trigger) after doing
// its own hierarchy check, so the whole role-change is applied atomically and
// correctly, the same way admin-create-employee already handles account creation.
//
// It also fixes a second latent bug: the old code matched the target profile by
// lower-cased email text instead of the real employees.user_id -> profiles.id FK,
// which could silently match nothing (and again leave the role unchanged) if the
// email casing/whitespace ever diverged between the two tables.

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Vary': 'Origin',
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Keep in sync with ROLE_RANK in src/lib/auth.ts, admin-create-employee/index.ts,
// and get_role_rank() in supabase/migrations/*_0015_role_security_hardening.sql.
const ROLE_RANK: Record<string, number> = {
  super_admin: 100, company_owner: 100, admin: 100,
  general_manager: 80,
  warehouse_manager: 60, branch_manager: 60, manager: 60,
  inventory_employee: 40, sales_employee: 40, marketing: 40,
  accountant: 40, customer_support: 40,
  staff: 20, customer: 0,
};
const rankOf = (r: string) => ROLE_RANK[r] ?? 0;

const ASSIGNABLE_ROLES = new Set(Object.keys(ROLE_RANK).filter((r) => r !== 'customer'));

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonError(405, 'Method not allowed');
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(500, 'Server configuration error');
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError(401, 'Missing or malformed authorization header');
    }
    const token = authHeader.slice(7);
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError(401, 'Invalid or expired token');
    }
    const callerId = userData.user.id;

    if (!checkRateLimit(callerId)) {
      return jsonError(429, 'Too many requests. Please slow down.');
    }

    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('role, status')
      .eq('id', callerId)
      .single();
    if (callerError || !callerProfile) {
      return jsonError(403, 'Profile not found');
    }
    if (callerProfile.status !== 'active') {
      return jsonError(403, 'Account is not active');
    }
    const callerRank = rankOf(callerProfile.role);
    if (callerRank < 60) {
      return jsonError(403, 'Your role is not authorized to change employee roles');
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const employeeId = String(body.employee_id ?? '');
    const role = String(body.role ?? '');
    if (!employeeId) return jsonError(400, 'employee_id is required');
    if (!role || !ASSIGNABLE_ROLES.has(role)) return jsonError(400, 'Invalid role');

    // Hierarchy check — identical rule to canAssignRole() in src/lib/auth.ts and
    // can_assign_role() in the database: top tier (100) may assign anyone, everyone
    // else may only assign a strictly lower-ranked role.
    if (callerRank < 100 && rankOf(role) >= callerRank) {
      return jsonError(403, 'You cannot assign a role equal to or higher than your own');
    }

    const { data: employee, error: employeeError } = await adminClient
      .from('employees')
      .select('id, user_id, email')
      .eq('id', employeeId)
      .single();
    if (employeeError || !employee) {
      return jsonError(404, 'Employee not found');
    }
    if (!employee.user_id) {
      return jsonError(409, 'This employee has no linked login account, so no role/permission change is needed');
    }

    // NOTE: employee_roles (the source of truth for granular permissions via
    // has_permission()) is intentionally NOT touched here. The caller
    // (AdminEmployees.tsx) already writes employee_roles directly — that write
    // is not blocked by anything, since trg_enforce_employee_role_hierarchy
    // permits it for any sufficiently-ranked authenticated caller. Duplicating
    // that logic here would risk clobbering the multi-role "assign additional
    // role" panel, which adds to employee_roles without replacing it.

    // The actual fix: this UPDATE runs as service_role, so
    // trg_prevent_role_self_escalation lets it through.
    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ role })
      .eq('id', employee.user_id);
    if (profileUpdateError) {
      return jsonError(500, `Failed to update profile role: ${profileUpdateError.message}`);
    }

    await adminClient.from('activity_logs').insert({
      user_id: callerId,
      action: 'update_employee_role',
      entity_type: 'employee',
      entity_id: employeeId,
      metadata: { new_role: role, target_user_id: employee.user_id, changed_by: userData.user.email },
    });

    await adminClient.from('security_events').insert({
      event_type: 'employee_role_changed',
      user_id: callerId,
      email: userData.user.email,
      severity: 'info',
      details: { employee_id: employeeId, target_user_id: employee.user_id, new_role: role },
    });

    return new Response(JSON.stringify({ success: true, role }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin-sync-employee-role error:', err);
    return jsonError(500, 'Internal server error');
  }
});
