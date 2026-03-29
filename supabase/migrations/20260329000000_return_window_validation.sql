-- Enforce 7-day return window on return_requests INSERT
-- Rejects returns if the order was delivered more than 7 days ago

CREATE OR REPLACE FUNCTION check_return_window()
RETURNS TRIGGER AS $$
DECLARE
    order_delivered_at timestamptz;
    order_status text;
BEGIN
    SELECT o.delivered_at, o.status
    INTO order_delivered_at, order_status
    FROM orders o
    WHERE o.id = NEW.order_id;

    -- Only allow returns on delivered orders
    IF order_status <> 'delivered' THEN
        RAISE EXCEPTION 'Returns can only be requested for delivered orders';
    END IF;

    -- Check the 7-day window
    IF order_delivered_at IS NULL THEN
        RAISE EXCEPTION 'Delivery date not recorded — contact support';
    END IF;

    IF NOW() > order_delivered_at + INTERVAL '7 days' THEN
        RAISE EXCEPTION 'Return window has closed (7 days from delivery)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_return_window ON return_requests;
CREATE TRIGGER enforce_return_window
    BEFORE INSERT ON return_requests
    FOR EACH ROW
    EXECUTE FUNCTION check_return_window();
