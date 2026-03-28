-- =============================================================================
-- Color of Nature — Address Fixes
-- 1. Correct country column default (was 'France', app uses 'India')
-- 2. Atomic set_default_address function (replaces two-round-trip UPDATE in frontend)
-- =============================================================================

-- ─── Fix country default ─────────────────────────────────────────────────────
ALTER TABLE public.addresses
  ALTER COLUMN country SET DEFAULT 'India';


-- ─── Atomic default-address setter ───────────────────────────────────────────
-- Sets exactly one address as default in a single UPDATE, avoiding the race
-- condition of unset-all then set-one.
CREATE OR REPLACE FUNCTION public.set_default_address(p_address_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE addresses
  SET    is_default = (id = p_address_id)
  WHERE  user_id = (SELECT user_id FROM addresses WHERE id = p_address_id)
    AND  user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_address(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_default_address(uuid) TO authenticated;
