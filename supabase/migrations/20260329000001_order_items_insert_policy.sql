-- Allow authenticated users to insert order items for their own orders
create policy "Users can insert own order items." on public.order_items for insert
  with check (exists (select 1 from public.orders where id = order_id and user_id = auth.uid()));
