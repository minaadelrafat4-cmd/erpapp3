import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Vary': 'Origin',
};

// Rate limiting: in-memory store (per-isolate). Keyed by user ID + action.
// Supabase edge functions are short-lived, so this is a best-effort throttle.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

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

// Input validation helpers
function validateEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email) && email.length <= 254;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 10) return 'Password must be at least 10 characters';
  if (password.length > 128) return 'Password must be at most 128 characters';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain a special character';
  return null;
}

function sanitize(str: string | undefined | null, maxLen = 255): string | null {
  if (!str) return null;
  const trimmed = str.trim().slice(0, maxLen);
  return trimmed || null;
}

const ALLOWED_ROLES = new Set([
  'general_manager', 'warehouse_manager', 'branch_manager', 'manager',
  'inventory_employee', 'sales_employee', 'marketing', 'accountant',
  'customer_support', 'staff',
]);

const ROLE_RANK: Record<string, number> = {
  super_admin: 100, company_owner: 100, admin: 100,
  general_manager: 80,
  warehouse_manager: 60, branch_manager: 60, manager: 60,
  inventory_employee: 40, sales_employee: 40, marketing: 40,
  accountant: 40, customer_support: 40,
  staff: 20,
};
const rankOf = (r: string) => ROLE_RANK[r] ?? 0;

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

    // Verify caller JWT
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

    // Rate limit per user
    if (!checkRateLimit(callerId)) {
      return jsonError(429, 'Too many requests. Please slow down.');
    }

    // Check caller profile
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, status')
      .eq('id', callerId)
      .single();

    if (profileError || !profile) {
      return jsonError(403, 'Profile not found');
    }

    if (profile.status !== 'active') {
      return jsonError(403, 'Account is not active');
    }

    const callerRank = rankOf(profile.role);
    if (callerRank < 60) {
      return jsonError(403, 'Your role is not authorized to create employee accounts');
    }

    // Parse and validate body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const email = sanitize(String(body.email ?? ''), 254);
    const password = String(body.password ?? '');
    const role = sanitize(String(body.role ?? ''), 50);
    const full_name = sanitize(String(body.full_name ?? ''), 200);
    const first_name = sanitize(String(body.first_name ?? ''), 100);
    const last_name = sanitize(String(body.last_name ?? ''), 100);
    const phone = sanitize(String(body.phone ?? ''), 30);
    const position = sanitize(String(body.position ?? ''), 100);
    const branch_id = body.branch_id ? String(body.branch_id) : null;
    const hire_date = body.hire_date ? String(body.hire_date) : null;
    const status = sanitize(String(body.status ?? 'active'), 20) ?? 'active';

    if (!email || !validateEmail(email)) {
      return jsonError(400, 'A valid email is required');
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return jsonError(400, passwordError);
    }
    if (!role || !ALLOWED_ROLES.has(role)) {
      return jsonError(400, 'Invalid role for employee');
    }

    // Hierarchy check: cannot assign equal or higher rank
    if (callerRank < 100 && rankOf(role) >= callerRank) {
      return jsonError(403, 'You cannot create an employee with equal or higher privileges than your own role');
    }

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || `${first_name ?? ''} ${last_name ?? ''}`.trim(),
        role,
        created_by_admin: true,
      },
    });

    if (createError || !newUser.user) {
      return jsonError(400, createError?.message ?? 'Failed to create user');
    }

    const userId = newUser.user.id;

    // Update profile role
    await adminClient
      .from('profiles')
      .update({ role, must_change_password: true, full_name: full_name || `${first_name ?? ''} ${last_name ?? ''}`.trim() })
      .eq('id', userId);

    // Create employee record
    const { error: empError } = await adminClient.from('employees').insert({
      user_id: userId,
      first_name: first_name ?? '',
      last_name: last_name ?? '',
      email,
      phone: phone,
      position: position,
      branch_id: branch_id,
      hire_date: hire_date,
      status,
    });

    if (empError) {
      return new Response(JSON.stringify({
        warning: 'User created but employee record failed',
        user_id: userId,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Assign role
    const { data: roleRecord } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', role)
      .single();

    if (roleRecord) {
      const { data: empRecord } = await adminClient
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (empRecord) {
        await adminClient.from('employee_roles').insert({
          employee_id: empRecord.id,
          role_id: roleRecord.id,
        });
      }
    }

    // Audit log
    await adminClient.from('activity_logs').insert({
      user_id: callerId,
      action: 'create_employee',
      entity_type: 'employee',
      entity_id: userId,
      metadata: { email, role, created_by: userData.user.email },
    });

    // Security event
    await adminClient.from('security_events').insert({
      event_type: 'employee_created',
      user_id: callerId,
      email: userData.user.email,
      severity: 'info',
      details: { new_employee_email: email, new_employee_role: role },
    });

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      message: 'Employee account created successfully',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    // Never leak internal error details to the client
    console.error('admin-create-employee error:', err);
    return jsonError(500, 'Internal server error');
  }
});
