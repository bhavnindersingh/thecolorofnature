-- =============================================================================
-- Color of Nature — Return Shipped RLS Policy (Part 2)
-- Separated from 20260328000000 because ALTER TYPE ADD VALUE must be committed
-- before the new enum value can be referenced in a policy.
-- =============================================================================


-- ─── RLS: Allow users to update own return status (approved -> item_shipped) ─
CREATE POLICY "Users can mark own return as shipped."
  ON public.return_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'approved')
  WITH CHECK (auth.uid() = user_id AND status = 'item_shipped');
