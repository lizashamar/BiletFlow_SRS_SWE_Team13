-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_ticket_type_id_idx" ON "tickets"("ticket_type_id");
