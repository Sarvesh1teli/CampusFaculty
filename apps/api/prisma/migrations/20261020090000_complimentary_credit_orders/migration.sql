ALTER TABLE "CommerceOrder" DROP CONSTRAINT commerce_amounts;
ALTER TABLE "CommerceOrder" ADD CONSTRAINT commerce_amounts CHECK (
 ("subtotal">0 AND "discount">=0 AND "amount"="subtotal"-"discount" AND "amount">0)
 OR ("subtotal"=0 AND "discount"=0 AND "amount"=0 AND "kind"='UNLOCK_PACK' AND "status"='APPROVED' AND COALESCE("snapshot"->>'paymentMethod','')='COMPLIMENTARY')
);
