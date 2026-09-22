-- Separate migration commits enum additions before constraints use them.
ALTER TYPE "point_transaction_type" ADD VALUE 'SPEND';
ALTER TYPE "point_transaction_reason" ADD VALUE 'TITLE_PURCHASE';
