-- Cover the sender_id foreign key in the customer support message table.
create index if not exists support_messages_sender_id_idx
  on public.support_messages(sender_id);
