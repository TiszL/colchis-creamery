-- QR table ordering: dine-in orders carry the scanned table number.
ALTER TABLE "Order" ADD COLUMN "tableNumber" INTEGER;
