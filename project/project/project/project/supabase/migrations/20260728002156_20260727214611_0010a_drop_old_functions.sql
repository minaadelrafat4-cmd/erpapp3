/*
# Production Hardening — Drop & Recreate Functions
Drops existing function signatures that need return-type or parameter changes.
*/
DROP FUNCTION IF EXISTS place_order(uuid, jsonb, jsonb, jsonb, text, text);
DROP FUNCTION IF EXISTS transfer_stock(uuid, integer, uuid, uuid, uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS receive_purchase_order(uuid);
DROP FUNCTION IF EXISTS process_return(uuid, text, jsonb, text);
DROP FUNCTION IF EXISTS issue_refund(uuid, numeric, text, text);
DROP FUNCTION IF EXISTS cancel_order(uuid, text);
